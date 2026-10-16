import { BroadcastChannel } from 'broadcast-channel';
import { z } from 'zod';

const limit = 10_000;
const recordSchema = z.object({
  snapshotId: z.uuidv4().nullable(),
  pending: z.array(z.uuidv4()).max(32),
  unseen: z.boolean(),
  token: z.uuidv4(),
  touchedAt: z.number().nonnegative(),
});
const storageSchema = z.object({
  version: z.literal(1),
  sound: z.boolean(),
  records: z.record(z.uuidv4(), recordSchema).refine((value) => Object.keys(value).length <= limit),
  sounded: z.array(z.uuidv4()).max(256),
});
const messageSchema = z.object({
  type: z.literal('changed'),
  alert: z.object({ shipmentId: z.uuidv4(), snapshotId: z.uuidv4() }).optional(),
});
export type ReviewRecord = z.infer<typeof recordSchema>;
type StoredState = z.infer<typeof storageSchema>;
export type RevisionAlert = NonNullable<z.infer<typeof messageSchema>['alert']>;
const empty = (): StoredState => ({ version: 1, sound: false, records: {}, sounded: [] });

/** Only public identities and review metadata cross this persistence boundary. */
export class ReviewStore {
  readonly key: string;
  private state = empty();
  private view = { ...this.state, warning: '' };
  private listeners = new Set<() => void>();
  private alerts = new Set<(alert: RevisionAlert) => void>();
  private channel?: BroadcastChannel;
  private active = true;
  private durable = true;
  private coordinated = true;
  private serial: Promise<unknown> = Promise.resolve();

  constructor(
    accountId: string,
    private storage: Storage | undefined,
    private locks?: LockManager,
  ) {
    this.key = `grd.tracking-review.v1:${accountId}`;
    this.read();
    this.publish();
  }

  connect() {
    try {
      this.channel = new BroadcastChannel(`${this.key}:changes`);
      this.channel.onmessage = (input: unknown) => {
        const result = messageSchema.safeParse(input);
        if (!result.success || !this.active) return;
        this.read();
        this.publish();
        if (result.data.alert) this.emitAlert(result.data.alert);
      };
    } catch {
      this.coordinated = false;
      this.warn('Cross-tab synchronization is unavailable. Sound is paused.');
    }
  }

  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  onAlert(listener: (alert: RevisionAlert) => void) {
    this.alerts.add(listener);
    return () => {
      this.alerts.delete(listener);
    };
  }
  private emitAlert(alert: RevisionAlert) {
    for (const listener of this.alerts) listener(alert);
  }
  private publish() {
    this.view = { ...this.state, warning: this.view.warning };
    for (const listener of this.listeners) listener();
  }
  private warn(warning: string) {
    this.view = { ...this.view, warning };
  }
  private read() {
    if (!this.durable) return;
    try {
      if (!this.storage) throw new Error('Unavailable storage');
      const raw = this.storage.getItem(this.key);
      if (!raw) {
        this.state = empty();
        return;
      }
      const parsed = raw.length <= 4_000_000 ? storageSchema.safeParse(JSON.parse(raw)) : null;
      if (!parsed?.success) throw new Error('Invalid stored reviews');
      this.state = parsed.data;
    } catch {
      this.durable = false;
      this.warn(
        'Review storage is unavailable or invalid. Changes are kept in this tab until it closes; sound is paused.',
      );
    }
  }

  private change(update: () => boolean, alert?: RevisionAlert): Promise<boolean> {
    const work = async () => {
      const mutate = () => {
        if (!this.active) return false;
        this.read();
        const changed = update();
        if (changed && this.durable) {
          try {
            const serialized = JSON.stringify(this.state);
            if (serialized.length > 4_000_000) throw new Error('Review storage limit');
            this.storage?.setItem(this.key, serialized);
          } catch {
            this.durable = false;
            this.warn(
              'Review storage is full or unavailable. Changes are kept in this tab until it closes; sound is paused.',
            );
          }
        }
        this.publish();
        if (changed) {
          if (alert) this.emitAlert(alert);
          void this.channel
            ?.postMessage({ type: 'changed', ...(alert ? { alert } : {}) })
            .catch(() => {
              if (!this.active) return;
              this.coordinated = false;
              this.warn('Cross-tab synchronization is unavailable. Sound is paused.');
              this.publish();
            });
        }
        return changed;
      };
      // Serialize read/modify/write across tabs as well as within this instance.
      if (this.locks) {
        try {
          return await this.locks.request(this.key, mutate);
        } catch {
          this.locks = undefined;
          this.durable = false;
          this.warn(
            'Review coordination is unavailable. Changes are kept in this tab until it closes; sound is paused.',
          );
          return mutate();
        }
      }
      this.warn(
        'Cross-tab coordination is unavailable. Sound is paused; review changes may not synchronize.',
      );
      return mutate();
    };
    const result = this.serial.then(work);
    this.serial = result.catch(() => undefined);
    return result;
  }

  private room(id: string) {
    if (this.state.records[id] || Object.keys(this.state.records).length < limit) return true;
    const reviewed = Object.entries(this.state.records)
      .filter(([, record]) => !record.unseen && !record.pending.length)
      .sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
    if (reviewed) {
      delete this.state.records[reviewed[0]];
      return true;
    }
    this.warn(
      'Review storage has reached 10,000 unreviewed shipments. Review existing changes to retain additional highlights.',
    );
    return false;
  }

  observe(id: string, snapshotId: string) {
    return this.change(() => {
      const old = this.state.records[id];
      if (old?.snapshotId === snapshotId || old?.pending.includes(snapshotId)) return false;
      if (!this.room(id)) return false;
      if ((old?.pending.length ?? 0) >= 32) {
        this.warn(
          'Too many unresolved updates for one shipment. Reconnect to reconcile its tracking history.',
        );
        return false;
      }
      this.state.records[id] = {
        snapshotId: old?.snapshotId ?? null,
        pending: [...(old?.pending ?? []), snapshotId],
        unseen: old?.unseen ?? false,
        token: crypto.randomUUID(),
        touchedAt: Date.now(),
      };
      return true;
    });
  }

  resolve(id: string, snapshotId: string | null, expected: ReviewRecord, quiet: boolean) {
    const shouldAlert =
      !!snapshotId &&
      expected.pending.includes(snapshotId) &&
      expected.snapshotId !== snapshotId &&
      !quiet;
    return this.change(
      () => {
        if (this.state.records[id]?.token !== expected.token) return false;
        this.state.records[id] = {
          snapshotId,
          pending: [],
          unseen:
            expected.unseen || (!!expected.pending.length && snapshotId !== expected.snapshotId),
          token: crypto.randomUUID(),
          touchedAt: Date.now(),
        };
        return true;
      },
      shouldAlert && snapshotId ? { shipmentId: id, snapshotId } : undefined,
    );
  }

  acknowledge(id: string, snapshotId: string, expected: ReviewRecord | undefined) {
    return this.change(() => {
      if (this.state.records[id]?.token !== expected?.token || !this.room(id)) return false;
      if (expected?.snapshotId === snapshotId && !expected.unseen && !expected.pending.length)
        return false;
      this.state.records[id] = {
        snapshotId,
        pending: [],
        unseen: false,
        token: crypto.randomUUID(),
        touchedAt: Date.now(),
      };
      return true;
    });
  }
  remove(id: string, expected: ReviewRecord | undefined) {
    return this.change(() => {
      if (!expected || this.state.records[id]?.token !== expected.token) return false;
      delete this.state.records[id];
      return true;
    });
  }
  setSound(value: boolean) {
    return this.change(() => {
      if (this.state.sound === value) return false;
      this.state.sound = value;
      return true;
    });
  }
  claimSound(snapshotIds: string[]) {
    return this.change(() => {
      if (!this.durable || !this.coordinated || !this.locks || !this.channel || !this.state.sound)
        return false;
      const fresh = snapshotIds.filter((id) => !this.state.sounded.includes(id));
      if (!fresh.length) return false;
      this.state.sounded = [...this.state.sounded, ...fresh].slice(-256);
      return true;
    }).then((claimed) => claimed && this.durable && this.coordinated);
  }
  stop() {
    this.active = false;
    this.listeners.clear();
    this.alerts.clear();
    void this.channel?.close().catch(() => undefined);
    this.state = empty();
    this.view = { ...this.state, warning: '' };
  }
}

export function hasUnseen(record: ReviewRecord | undefined) {
  return !!record && (record.unseen || record.pending.length > 0);
}
