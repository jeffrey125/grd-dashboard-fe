import { ApiError } from '@api/api';
import type { Query, QueryClient } from '@tanstack/react-query';
import type { LiveEvent } from './events';

type Target =
  | { kind: 'shipments' | 'overview' | 'carriers' }
  | { kind: 'shipment' | 'history' | 'run'; externalId: string };
type Registration = { target: Target; carrierDependent?: boolean; onMissing?: () => void };

/** Spread into feature-owned query options. Keys and response shapes stay in the feature. */
export function liveQuery(registration: Registration) {
  return {
    meta: { live: registration },
    // This coordinator owns these triggers, including the 30-second carrier focus policy.
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: false as const,
  };
}

function registration(query: Query): Registration | undefined {
  return query.meta?.live as Registration | undefined;
}

function carrierDependent(value: Registration) {
  return value.carrierDependent || value.target.kind === 'carriers';
}

function matches(value: Registration, event: LiveEvent) {
  const target = value.target;
  if (event.type === 'heartbeat') return false;
  if (event.type === 'resync') return true;
  if (event.type === 'run.changed')
    return target.kind === 'run' && target.externalId === event.externalId;
  return (
    target.kind === 'shipments' ||
    target.kind === 'overview' ||
    ((target.kind === 'shipment' || target.kind === 'history') &&
      target.externalId === event.externalId)
  );
}

/** One dirty bit per query survives initial/in-flight fetches and bounds burst work. */
export class QueryRefresh {
  private pending = new Map<Query, number>();
  private unsettled = new Set<Query>();
  private timer?: ReturnType<typeof setTimeout>;
  private unsubscribe?: () => void;

  constructor(
    private readonly client: QueryClient,
    private readonly changed: () => void,
  ) {}

  start() {
    this.unsubscribe = this.client.getQueryCache().subscribe((event) => {
      const query = event.query;
      if (event.type === 'removed') {
        this.pending.delete(query);
        this.unsettled.delete(query);
      }
      if (event.type === 'updated' && event.action.type === 'error') {
        const value = registration(query);
        if (
          value &&
          (value.target.kind === 'shipment' || value.target.kind === 'history') &&
          query.state.error instanceof ApiError &&
          query.state.error.status === 404
        ) {
          // Query retains old data on a failed refetch. A confirmed deletion must not.
          this.pending.delete(query);
          this.unsettled.delete(query);
          query.setState({ data: undefined });
          if (query.isActive()) value.onMissing?.();
        }
      }
      if (
        event.type === 'updated' &&
        event.action.type === 'success' &&
        !event.action.manual &&
        !this.pending.has(query)
      )
        this.unsettled.delete(query);
      this.schedule();
      this.changed();
    });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending.clear();
    this.unsettled.clear();
  }

  get stale() {
    return [...this.unsettled].some((query) => query.isActive());
  }

  event(event: LiveEvent) {
    this.mark((value) => matches(value, event));
  }

  carriers(focus = false) {
    this.mark(
      (value, query) =>
        !!carrierDependent(value) &&
        (!focus || (query.isActive() && Date.now() - query.state.dataUpdatedAt >= 30_000)),
    );
  }

  private mark(matchesTarget: (value: Registration, query: Query) => boolean) {
    for (const query of this.client.getQueryCache().getAll()) {
      const value = registration(query);
      if (!value || !matchesTarget(value, query)) continue;
      // Mark before invalidating: QueryCache notifications are synchronous.
      if (!this.pending.has(query)) this.pending.set(query, Date.now() + 100);
      this.unsettled.add(query);
      query.invalidate();
    }
    this.schedule();
    this.changed();
  }

  private schedule() {
    if (!this.unsubscribe || this.timer !== undefined) return;
    const ready = [...this.pending].filter(([query]) => query.state.fetchStatus === 'idle');
    if (!ready.length) return;
    const due = Math.min(...ready.map(([, time]) => time));
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        for (const [query, time] of this.pending) {
          if (query.state.fetchStatus !== 'idle' || time > Date.now()) continue;
          this.pending.delete(query);
          // Inactive entries stay invalidated; navigation refetches them on demand.
          if (!query.isActive()) {
            query.invalidate();
            this.unsettled.delete(query);
            continue;
          }
          void this.client.refetchQueries(
            { predicate: (candidate) => candidate === query },
            { cancelRefetch: false },
          );
        }
        this.schedule();
        this.changed();
      },
      Math.max(0, due - Date.now()),
    );
  }
}
