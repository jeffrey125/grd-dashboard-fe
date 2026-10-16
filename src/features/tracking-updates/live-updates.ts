import type { QueryClient } from '@tanstack/react-query';
import { eventNames, type LiveEvent, parseEvent } from './events';
import { QueryRefresh } from './query-refresh';

type State = {
  started: boolean;
  connection: 'connecting' | 'disconnected' | 'connected';
  stale: boolean;
  warning: boolean;
};

export class LiveUpdates {
  private state: State = {
    started: false,
    connection: 'connecting',
    stale: true,
    warning: false,
  };
  private listeners = new Set<() => void>();
  private consumers = new Set<(event: LiveEvent) => void>();
  private source?: EventSource;
  private generation = 0;
  private resynced = false;
  private warningTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setTimeout>;
  private retryDelay = 2_000;
  private removeListeners?: () => void;
  private readonly refresh: QueryRefresh;

  constructor(
    private readonly url: string,
    queries: QueryClient,
    private readonly recheck: () => Promise<void>,
    private readonly createSource = (url: string) =>
      new EventSource(url, { withCredentials: true }),
  ) {
    this.refresh = new QueryRefresh(queries, () => this.publish());
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** FE-V1-011 can observe validated revisions; callbacks must unsubscribe on unmount. */
  onEvent(consumer: (event: LiveEvent) => void) {
    this.consumers.add(consumer);
    return () => {
      this.consumers.delete(consumer);
    };
  }

  /** Call after a successful carrier edit; also invalidates carrier-dependent projections. */
  refreshCarriers = () => {
    if (this.state.started) this.refresh.carriers();
  };

  start() {
    if (this.state.started) return;
    this.state = { ...this.state, started: true };
    this.refresh.start();
    document.addEventListener('visibilitychange', this.focus);
    window.addEventListener('focus', this.focus);
    this.connect();
  }

  stop = () => {
    this.generation += 1;
    this.removeListeners?.();
    this.source?.close();
    this.source = undefined;
    this.removeListeners = undefined;
    this.refresh.stop();
    clearTimeout(this.warningTimer);
    clearTimeout(this.retryTimer);
    clearTimeout(this.heartbeatTimer);
    this.warningTimer = this.retryTimer = this.heartbeatTimer = undefined;
    document.removeEventListener('visibilitychange', this.focus);
    window.removeEventListener('focus', this.focus);
    this.consumers.clear();
    this.resynced = false;
    this.retryDelay = 2_000;
    this.state = { started: false, connection: 'connecting', stale: true, warning: false };
    this.notify();
  };

  private focus = () => {
    if (document.visibilityState !== 'hidden') this.refresh.carriers(true);
  };

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private publish() {
    if (!this.state.started) return;
    const stale = !this.resynced || this.refresh.stale;
    const next = { ...this.state, stale, warning: stale && this.state.warning };
    if (stale && this.warningTimer === undefined && !next.warning) {
      this.warningTimer = setTimeout(() => {
        this.warningTimer = undefined;
        if (!this.state.started || !this.state.stale) return;
        this.state = { ...this.state, warning: true };
        this.notify();
      }, 2_000);
    }
    if (!stale) {
      clearTimeout(this.warningTimer);
      this.warningTimer = undefined;
    }
    if (next.stale !== this.state.stale || next.warning !== this.state.warning) {
      this.state = next;
    }
    this.notify();
  }

  private connect() {
    this.removeListeners?.();
    this.source?.close();
    const generation = ++this.generation;
    const current = () => generation === this.generation && this.state.started;
    this.resynced = false;
    this.state = { ...this.state, connection: 'connecting' };
    try {
      const source = this.createSource(this.url);
      this.source = source;
      const bindings: Array<[string, EventListener]> = [];
      for (const name of eventNames) {
        const handler = ((message: MessageEvent<string>) => {
          if (!current()) return;
          const event = parseEvent(name, message.data);
          if (!event) {
            // A malformed invalidation may represent a missed update. Refresh quietly.
            this.refresh.event({ type: 'resync' });
            return;
          }
          this.watchHeartbeat(generation);
          if (event.type === 'resync') {
            this.resynced = true;
            this.retryDelay = 2_000;
            this.state = { ...this.state, connection: 'connected' };
          }
          this.refresh.event(event);
          for (const consumer of this.consumers) {
            try {
              consumer(event);
            } catch {
              /* Isolate optional alert consumers. */
            }
          }
          this.publish();
        }) as EventListener;
        bindings.push([name, handler]);
        source.addEventListener(name, handler);
      }
      const onError = () => {
        if (current()) this.disconnected(generation);
      };
      bindings.push(['error', onError]);
      source.addEventListener('error', onError);
      this.removeListeners = () => {
        for (const [name, handler] of bindings) source.removeEventListener(name, handler);
      };
      this.watchHeartbeat(generation);
    } catch {
      this.disconnected(generation);
    }
    this.publish();
  }

  private watchHeartbeat(generation: number) {
    clearTimeout(this.heartbeatTimer);
    // Backend heartbeat is 15s. Detect a stalled/open stream after three missed beats.
    this.heartbeatTimer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.removeListeners?.();
      this.source?.close();
      this.disconnected(generation);
    }, 45_000);
  }

  private disconnected(generation: number) {
    this.resynced = false;
    this.state = { ...this.state, connection: 'disconnected' };
    this.publish();
    if (this.retryTimer !== undefined) return;
    this.retryTimer = setTimeout(async () => {
      // Keep the timer occupied while the shared auth check is pending.
      try {
        await this.recheck();
      } catch {
        // Session owns visible auth failures; never leak an unhandled timer rejection.
      }
      if (generation !== this.generation || !this.state.started) return;
      this.retryTimer = undefined;
      this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
      // Native EventSource retries CONNECTING streams. CLOSED needs explicit recovery.
      if (!this.source || this.source.readyState === 2) this.connect();
    }, this.retryDelay);
  }
}
