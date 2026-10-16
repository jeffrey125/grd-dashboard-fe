import type { LiveEvent } from './events';
import { hasUnseen, type ReviewStore } from './review-store';

export type DisplayedRevision = { shipmentId: string; snapshotId: string };
export type ReadCurrent = (id: string, signal: AbortSignal) => Promise<string | null>;

/** HTTP establishes the current revision; event timestamps never order revisions. */
export class ReviewController {
  private abort = new AbortController();
  private queue = new Map<string, boolean>();
  private busy = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  private epoch = 0;
  constructor(
    readonly store: ReviewStore,
    private readCurrent: ReadCurrent,
    private isMissing: (error: unknown) => boolean,
  ) {}

  event = (event: LiveEvent) => {
    if (event.type === 'resync') {
      this.epoch += 1;
      for (const [id, record] of Object.entries(this.store.getSnapshot().records)) {
        if (hasUnseen(record)) this.enqueue(id, true);
      }
    } else if (event.type === 'tracking.changed') {
      void this.store.observe(event.externalId, event.snapshotExternalId).then(() => {
        if (this.store.getSnapshot().records[event.externalId]?.pending.length)
          this.enqueue(event.externalId, false);
      });
    } else if (
      event.type === 'shipment.changed' &&
      this.store.getSnapshot().records[event.externalId]
    ) {
      this.enqueue(event.externalId, true);
    }
  };

  private enqueue(id: string, quiet: boolean) {
    if (this.abort.signal.aborted) return;
    this.queue.set(id, (this.queue.get(id) ?? true) && quiet);
    this.timer ??= setTimeout(this.drain, 100);
  }
  private drain = () => {
    this.timer = undefined;
    for (const [id, quiet] of this.queue) {
      if (this.busy.size >= 4) break;
      if (this.busy.has(id)) continue;
      this.queue.delete(id);
      this.busy.add(id);
      void this.resolve(id, quiet).finally(() => {
        this.busy.delete(id);
        if (this.queue.size && !this.abort.signal.aborted)
          this.timer ??= setTimeout(this.drain, 100);
      });
    }
  };
  private async resolve(id: string, quiet: boolean) {
    const expected = this.store.getSnapshot().records[id];
    if (!expected) return;
    const epoch = this.epoch;
    try {
      const snapshotId = await this.readCurrent(id, this.abort.signal);
      if (this.abort.signal.aborted) return;
      // Generic invalidations may precede the precise event. They check deletion,
      // but must not install a quiet baseline that would swallow that later event.
      if (!expected.pending.length) return;
      const applied = await this.store.resolve(
        id,
        snapshotId,
        expected,
        quiet || epoch !== this.epoch,
      );
      if (!applied && this.store.getSnapshot().records[id]?.pending.length) this.enqueue(id, quiet);
    } catch (error) {
      if (!this.abort.signal.aborted && this.isMissing(error))
        await this.store.remove(id, expected);
      // Retain unresolved identities on network failure; resync or another event retries.
    }
  }

  acknowledge = async (
    { shipmentId, snapshotId }: DisplayedRevision,
    stillDisplayed: () => boolean = () => true,
  ) => {
    const expected = this.store.getSnapshot().records[shipmentId];
    if (expected?.snapshotId === snapshotId && !hasUnseen(expected)) return;
    try {
      const current = await this.readCurrent(shipmentId, this.abort.signal);
      if (!this.abort.signal.aborted && stillDisplayed() && current === snapshotId)
        await this.store.acknowledge(shipmentId, snapshotId, expected);
    } catch (error) {
      if (!this.abort.signal.aborted && this.isMissing(error))
        await this.store.remove(shipmentId, expected);
    }
  };
  stop() {
    this.abort.abort();
    clearTimeout(this.timer);
    this.queue.clear();
  }
}
