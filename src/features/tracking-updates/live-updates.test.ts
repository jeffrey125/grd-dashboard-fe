import { ApiError } from '@api/api';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { type LiveEvent, LiveUpdates, liveQuery } from './index';

const shipmentId = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';
const snapshotId = '33333333-3333-4333-8333-333333333333';
class Source extends EventTarget {
  readyState = 1;
  close = vi.fn(() => {
    this.readyState = 2;
  });
  emit(type: string, data: unknown = {}) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}
let queries: QueryClient;
let sources: Source[];
let live: LiveUpdates;
let recheck: ReturnType<typeof vi.fn<() => Promise<void>>>;
const unsubscribes: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers();
  queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  sources = [];
  recheck = vi.fn(async () => {});
  live = new LiveUpdates('/api/v1/events', queries, recheck, () => {
    const source = new Source();
    sources.push(source);
    return source as unknown as EventSource;
  });
  live.start();
});
afterEach(() => {
  live.stop();
  for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
  queries.clear();
});
function source() {
  return sources.at(-1) as Source;
}
function observe(
  key: string,
  queryFn: () => Promise<string>,
  options = liveQuery({ target: { kind: 'shipments' } }),
) {
  const observer = new QueryObserver(queries, {
    queryKey: [key],
    queryFn,
    ...options,
  });
  unsubscribes.push(observer.subscribe(() => {}));
  return observer;
}
function deferred() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function tick(ms = 100) {
  await vi.advanceTimersByTimeAsync(ms);
}

it('defers cache-driven status notifications when a run observer mounts during render', async () => {
  source().emit('resync');
  await tick();
  const listener = vi.fn();
  unsubscribes.push(live.subscribe(listener));
  observe('run', async () => 'run', liveQuery({ target: { kind: 'run', externalId: runId } }));
  expect(listener).not.toHaveBeenCalled();
  await tick();
  expect(listener).toHaveBeenCalled();
});

it('coalesces paired/burst events and follows an initial in-flight fetch with authoritative data', async () => {
  const first = deferred();
  const fetch = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue('current');
  observe('list', fetch);
  source().emit('resync');
  for (let i = 0; i < 20; i++) {
    source().emit('shipment.changed', { externalId: shipmentId });
    source().emit('tracking.changed', {
      externalId: shipmentId,
      snapshotExternalId: snapshotId,
      observedAt: '2026-10-16T00:00:00.000Z',
    });
  }
  await tick(200);
  expect(fetch).toHaveBeenCalledTimes(1);
  first.resolve('old');
  await tick();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(queries.getQueryData(['list'])).toBe('current');
  expect(live.getSnapshot().stale).toBe(false);
});

it('keeps only one pending follow-up while a background fetch runs', async () => {
  const second = deferred();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce('initial')
    .mockReturnValueOnce(second.promise)
    .mockResolvedValue('newest');
  observe('list', fetch);
  await tick();
  source().emit('shipment.changed', { externalId: shipmentId });
  await tick();
  for (let i = 0; i < 50; i++) source().emit('shipment.changed', { externalId: shipmentId });
  await tick(200);
  expect(fetch).toHaveBeenCalledTimes(2);
  second.resolve('intermediate');
  await tick();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(queries.getQueryData(['list'])).toBe('newest');
});

it('resync refreshes explicit runs, detail/history and aggregates; heartbeat does not fetch', async () => {
  const run = vi.fn(async () => 'run');
  const list = vi.fn(async () => 'list');
  observe('list', list);
  const detail = vi.fn(async () => 'detail');
  const history = vi.fn(async () => 'history');
  const overview = vi.fn(async () => 'overview');
  observe('run', run, liveQuery({ target: { kind: 'run', externalId: runId } }));
  observe('detail', detail, liveQuery({ target: { kind: 'shipment', externalId: shipmentId } }));
  observe('history', history, liveQuery({ target: { kind: 'history', externalId: shipmentId } }));
  observe('overview', overview, liveQuery({ target: { kind: 'overview' } }));
  await tick();
  source().emit('run.changed', { externalId: runId });
  await tick();
  expect(run).toHaveBeenCalledTimes(2);
  expect(list).toHaveBeenCalledTimes(2);
  expect(detail).toHaveBeenCalledTimes(2);
  source().emit('resync');
  await tick();
  expect(run).toHaveBeenCalledTimes(3);
  expect(detail).toHaveBeenCalledTimes(3);
  for (const fetch of [history, overview]) expect(fetch).toHaveBeenCalledTimes(2);
  source().emit('heartbeat');
  await tick();
  expect(run).toHaveBeenCalledTimes(3);
});

it('keeps inactive caches invalidated without fetching and isolates unrelated IDs', async () => {
  const inactive = vi.fn(async () => 'cached');
  await queries.fetchQuery({
    queryKey: ['inactive'],
    queryFn: inactive,
    ...liveQuery({ target: { kind: 'shipments' } }),
  });
  const other = vi.fn(async () => 'other');
  observe('other', other, liveQuery({ target: { kind: 'shipment', externalId: runId } }));
  await tick();
  source().emit('shipment.changed', { externalId: shipmentId });
  await tick();
  expect(inactive).toHaveBeenCalledOnce();
  expect(other).toHaveBeenCalledOnce();
  expect(queries.getQueryState(['inactive'])?.isInvalidated).toBe(true);
});

it('removes retained detail data on a confirmed deletion and not on a server failure', async () => {
  const missing = vi.fn();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce('private detail')
    .mockRejectedValueOnce(new ApiError(500, 'Failure'))
    .mockRejectedValueOnce(new ApiError(404, 'Missing'));
  observe(
    'detail',
    fetch,
    liveQuery({ target: { kind: 'shipment', externalId: shipmentId }, onMissing: missing }),
  );
  await tick();
  source().emit('resync');
  await tick(2_100);
  expect(queries.getQueryData(['detail'])).toBe('private detail');
  expect(live.getSnapshot().warning).toBe(true);
  expect(missing).not.toHaveBeenCalled();
  source().emit('shipment.changed', { externalId: shipmentId });
  await tick();
  expect(queries.getQueryData(['detail'])).toBeUndefined();
  expect(queries.getQueryState(['detail'])?.status).toBe('error');
  expect(missing).toHaveBeenCalledOnce();
  await tick(1); // Query's notification scheduler publishes after the cache update.
  expect(live.getSnapshot().warning).toBe(false);
});

it('uses the 30s focus policy and bypasses it for carrier edits and resync', async () => {
  const fetch = vi.fn(async () => 'carrier');
  const projection = vi.fn(async () => 'shipment projection');
  observe('carriers', fetch, liveQuery({ target: { kind: 'carriers' } }));
  observe(
    'projection',
    projection,
    liveQuery({ target: { kind: 'shipments' }, carrierDependent: true }),
  );
  await tick();
  window.dispatchEvent(new Event('focus'));
  await tick();
  expect(fetch).toHaveBeenCalledOnce();
  await tick(30_000);
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  await tick();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(projection).toHaveBeenCalledTimes(2);
  live.refreshCarriers();
  await tick();
  expect(fetch).toHaveBeenCalledTimes(3);
  source().emit('resync');
  await tick();
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('waits for resync and completed recovery fetches before clearing the delayed warning', async () => {
  await tick(1_999);
  expect(live.getSnapshot().warning).toBe(false);
  source().emit('open');
  await tick(1);
  expect(live.getSnapshot().warning).toBe(true);
  const pending = deferred();
  const fetch = vi.fn().mockResolvedValueOnce('initial').mockReturnValueOnce(pending.promise);
  observe('list', fetch);
  await tick();
  source().emit('resync');
  await tick();
  expect(live.getSnapshot().warning).toBe(true);
  pending.resolve('recovered');
  await tick();
  expect(live.getSnapshot()).toMatchObject({
    warning: false,
    stale: false,
    connection: 'connected',
  });
});

it('deduplicates error auth checks, recreates closed streams and backs off persistent failure', async () => {
  source().close();
  for (let i = 0; i < 10; i++) source().emit('error');
  await tick(2_000);
  expect(recheck).toHaveBeenCalledOnce();
  expect(sources).toHaveLength(2);
  source().close();
  source().emit('error');
  await tick(3_999);
  expect(recheck).toHaveBeenCalledOnce();
  await tick(1);
  expect(recheck).toHaveBeenCalledTimes(2);
});

it('does not replace a native reconnecting source and closes on a revoked session check', async () => {
  source().readyState = 0;
  source().emit('error');
  await tick(2_000);
  expect(sources).toHaveLength(1);
  recheck.mockImplementationOnce(async () => live.stop());
  source().emit('error');
  await tick(4_000);
  expect(source().close).toHaveBeenCalledOnce();
  expect(live.getSnapshot().started).toBe(false);
});

it('ignores old callbacks/consumers across stop/start and cancels queued invalidations', async () => {
  const consumer = vi.fn<(event: LiveEvent) => void>();
  const unsubscribe = live.onEvent(consumer);
  const fetch = vi.fn(async () => 'data');
  observe('list', fetch);
  await tick();
  const old = source();
  old.emit('shipment.changed', { externalId: shipmentId });
  expect(consumer).toHaveBeenCalledOnce();
  live.stop();
  live.start();
  old.emit('resync');
  old.emit('error');
  await tick();
  expect(fetch).toHaveBeenCalledOnce();
  source().emit('resync');
  await tick();
  expect(consumer).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledTimes(2);
  unsubscribe();
});

it('validates event identities, isolates consumers and recovers malformed invalidations quietly', async () => {
  const fetch = vi.fn(async () => 'data');
  observe('list', fetch);
  await tick();
  const consumer = vi.fn();
  live.onEvent(() => {
    throw new Error('consumer failure');
  });
  live.onEvent(consumer);
  source().emit('tracking.changed', { externalId: 'invalid' });
  await tick();
  expect(consumer).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(2);
  source().emit('tracking.changed', {
    externalId: shipmentId,
    snapshotExternalId: snapshotId,
    observedAt: '2026-10-16T00:00:00.000Z',
  });
  expect(consumer).toHaveBeenCalledWith(
    expect.objectContaining({ snapshotExternalId: snapshotId }),
  );
});

it('detects a stalled stream and never multiplies connections on repeated start', async () => {
  live.start();
  live.start();
  expect(sources).toHaveLength(1);
  source().emit('resync');
  await tick(45_000);
  expect(source().close).toHaveBeenCalled();
  expect(live.getSnapshot().connection).toBe('disconnected');
  await tick(2_000);
  expect(sources).toHaveLength(2);
});
