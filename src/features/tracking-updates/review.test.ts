import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewController } from './review-controller';
import { hasUnseen, ReviewStore } from './review-store';

const account = '11111111-1111-4111-8111-111111111111';
const shipment = '22222222-2222-4222-8222-222222222222';
const first = '33333333-3333-4333-8333-333333333333';
const second = '44444444-4444-4444-8444-444444444444';
const third = '55555555-5555-4555-8555-555555555555';
const stores: ReviewStore[] = [];
const controllers: ReviewController[] = [];
const locks = {
  request: async (_key: string, callback: () => unknown) => callback(),
} as unknown as LockManager;
function setup(
  read = vi.fn<() => Promise<string | null>>().mockResolvedValue(first),
  storage: Storage | undefined = localStorage,
) {
  const store = new ReviewStore(account, storage, locks);
  const controller = new ReviewController(store, read, (error) => error === 'missing');
  stores.push(store);
  controllers.push(controller);
  return { store, controller, read };
}
function event(controller: ReviewController, snapshotExternalId = first) {
  controller.event({
    type: 'tracking.changed',
    externalId: shipment,
    snapshotExternalId,
    observedAt: '2026-10-16T00:00:00Z',
  });
}
async function tick() {
  await vi.advanceTimersByTimeAsync(150);
}
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.stop();
  for (const store of stores.splice(0)) store.stop();
});

describe('persistent review identities', () => {
  it('retries an event arriving during reconciliation instead of accepting the older response', async () => {
    vi.useFakeTimers();
    let finish: (id: string) => void = () => undefined;
    const read = vi.fn<() => Promise<string | null>>().mockResolvedValue(second);
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { store, controller } = setup(read);
    const alert = vi.fn();
    store.onAlert(alert);
    event(controller);
    await tick();
    event(controller, second);
    await tick();
    finish(first);
    await tick();
    await tick();
    expect(store.getSnapshot().records[shipment]?.snapshotId).toBe(second);
    expect(alert).toHaveBeenCalledExactlyOnceWith({ shipmentId: shipment, snapshotId: second });
  });

  it('keeps in-memory review state when storage writes or browser locks fail', async () => {
    const quotaStorage = {
      getItem: () => null,
      setItem() {
        throw new Error('Quota exceeded');
      },
    } as unknown as Storage;
    const { store } = setup(undefined, quotaStorage);
    await store.observe(shipment, first);
    expect(hasUnseen(store.getSnapshot().records[shipment])).toBe(true);
    expect(store.getSnapshot().warning).toContain('full or unavailable');
    const deniedLocks = {
      request: () => Promise.reject(new Error('Blocked lock')),
    } as unknown as LockManager;
    const other = new ReviewStore(third, localStorage, deniedLocks);
    stores.push(other);
    await other.observe(shipment, first);
    expect(hasUnseen(other.getSnapshot().records[shipment])).toBe(true);
    expect(other.getSnapshot().warning).toContain('coordination is unavailable');
  });

  it('deduplicates events and retains unseen highlights across reload, without storing business data', async () => {
    const { store, controller } = setup();
    vi.useFakeTimers();
    const alert = vi.fn();
    store.onAlert(alert);
    event(controller);
    event(controller);
    await tick();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(hasUnseen(store.getSnapshot().records[shipment])).toBe(true);
    const restored = setup().store;
    expect(hasUnseen(restored.getSnapshot().records[shipment])).toBe(true);
    expect(JSON.parse(localStorage.getItem(store.key) ?? '')).toMatchObject({
      version: 1,
      sound: false,
    });
    expect(localStorage.getItem(store.key)).not.toMatch(/trackingReference|notes|cookie|password/);
    event(controller);
    await tick();
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('never orders revisions by arrival time or observedAt, and suppresses old events after review', async () => {
    vi.useFakeTimers();
    const { store, controller, read } = setup();
    const alert = vi.fn();
    store.onAlert(alert);
    event(controller);
    await tick();
    read.mockResolvedValue(second);
    event(controller, second);
    await tick();
    event(controller, first);
    await tick();
    expect(store.getSnapshot().records[shipment]?.snapshotId).toBe(second);
    expect(alert).toHaveBeenCalledTimes(2);
    await controller.acknowledge({ shipmentId: shipment, snapshotId: second });
    event(controller, first);
    await tick();
    expect(hasUnseen(store.getSnapshot().records[shipment])).toBe(false);
    expect(alert).toHaveBeenCalledTimes(2);
  });

  it('acknowledges a newer displayed authoritative revision and preserves concurrent events', async () => {
    vi.useFakeTimers();
    const { store, controller, read } = setup();
    event(controller);
    await tick();
    read.mockResolvedValue(second);
    await controller.acknowledge({ shipmentId: shipment, snapshotId: second });
    expect(hasUnseen(store.getSnapshot().records[shipment])).toBe(false);
    let complete: (value: string) => void = () => undefined;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const reviewing = controller.acknowledge({ shipmentId: shipment, snapshotId: third });
    await store.observe(shipment, third);
    complete(third);
    await reviewing;
    expect(hasUnseen(store.getSnapshot().records[shipment])).toBe(true);
  });

  it('does not acknowledge hidden/unmounted details, old displayed rows, or other shipments', async () => {
    vi.useFakeTimers();
    const { store, controller, read } = setup();
    event(controller);
    await tick();
    await store.observe(third, first);
    await controller.acknowledge({ shipmentId: shipment, snapshotId: first }, () => false);
    expect(hasUnseen(store.getSnapshot().records[shipment])).toBe(true);
    read.mockResolvedValue(second);
    await controller.acknowledge({ shipmentId: shipment, snapshotId: first });
    expect(hasUnseen(store.getSnapshot().records[shipment])).toBe(true);
    await controller.acknowledge({ shipmentId: shipment, snapshotId: second });
    expect(hasUnseen(store.getSnapshot().records[shipment])).toBe(false);
    expect(hasUnseen(store.getSnapshot().records[third])).toBe(true);
  });

  it('retains unresolved events after a failed read and reconciles quietly on resync', async () => {
    vi.useFakeTimers();
    const { store, controller, read } = setup();
    const alert = vi.fn();
    store.onAlert(alert);
    read.mockRejectedValueOnce(new Error('offline'));
    event(controller);
    await tick();
    expect(store.getSnapshot().records[shipment]?.pending).toEqual([first]);
    controller.event({ type: 'resync' });
    await tick();
    expect(hasUnseen(store.getSnapshot().records[shipment])).toBe(true);
    expect(store.getSnapshot().records[shipment]?.pending).toEqual([]);
    expect(alert).not.toHaveBeenCalled();
  });

  it('generic invalidations stay quiet without swallowing a later precise change; 404 cleans records', async () => {
    vi.useFakeTimers();
    const { store, controller, read } = setup();
    const alert = vi.fn();
    store.onAlert(alert);
    event(controller);
    await tick();
    await controller.acknowledge({ shipmentId: shipment, snapshotId: first });
    read.mockResolvedValue(second);
    controller.event({ type: 'shipment.changed', externalId: shipment });
    await tick();
    expect(alert).toHaveBeenCalledTimes(1);
    event(controller, second);
    await tick();
    expect(alert).toHaveBeenCalledTimes(2);
    read.mockRejectedValue('missing');
    controller.event({ type: 'shipment.changed', externalId: shipment });
    await tick();
    expect(store.getSnapshot().records[shipment]).toBeUndefined();
  });

  it('compares storage tokens before applying stale cross-tab responses', async () => {
    const { store } = setup();
    await store.observe(shipment, first);
    const expected = store.getSnapshot().records[shipment];
    if (!expected) throw new Error('Missing revision');
    const other = setup().store;
    await other.observe(shipment, second);
    expect(await store.resolve(shipment, first, expected, false)).toBe(false);
    expect(store.getSnapshot().records[shipment]?.pending).toEqual([first, second]);
  });

  it.each(['blocked', 'malformed', 'old version'])(
    'falls back to isolated memory for %s storage',
    async (scenario) => {
      const key = `grd.tracking-review.v1:${account}`;
      if (scenario !== 'blocked')
        localStorage.setItem(key, scenario === 'malformed' ? '{' : '{"version":0}');
      const blocked = {
        getItem() {
          throw new Error('blocked');
        },
        setItem() {
          throw new Error('blocked');
        },
      } as unknown as Storage;
      const { store } = setup(undefined, scenario === 'blocked' ? blocked : localStorage);
      await store.observe(shipment, first);
      expect(hasUnseen(store.getSnapshot().records[shipment])).toBe(true);
      expect(store.getSnapshot().warning).toContain('this tab');
      expect(await store.claimSound([first])).toBe(false);
      const otherAccount = new ReviewStore(third, localStorage, locks);
      stores.push(otherAccount);
      expect(otherAccount.getSnapshot().records).toEqual({});
      expect(otherAccount.getSnapshot().sound).toBe(false);
    },
  );

  it('caps retained shipments without evicting unseen marks', async () => {
    const records = Object.fromEntries(
      Array.from({ length: 10_000 }, (_, i) => [
        `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        { snapshotId: first, pending: [], unseen: true, token: second, touchedAt: 1 },
      ]),
    );
    localStorage.setItem(
      `grd.tracking-review.v1:${account}`,
      JSON.stringify({ version: 1, records, sound: false, sounded: [] }),
    );
    const { store } = setup();
    expect(await store.observe(shipment, second)).toBe(false);
    expect(Object.keys(store.getSnapshot().records)).toHaveLength(10_000);
    expect(store.getSnapshot().warning).toContain('10,000');
  });

  it('session teardown aborts work and prevents late responses from writing', async () => {
    vi.useFakeTimers();
    let finish: (value: string) => void = () => undefined;
    const read = vi.fn<() => Promise<string | null>>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { store, controller } = setup(read);
    const alert = vi.fn();
    store.onAlert(alert);
    event(controller);
    await tick();
    controller.stop();
    store.stop();
    finish(first);
    await tick();
    expect(alert).not.toHaveBeenCalled();
    expect(store.getSnapshot().records).toEqual({});
  });
});
