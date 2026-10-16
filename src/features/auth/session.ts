import { type ApiClient, ApiError, SessionCancelled, safeError } from '@api/api';
import type { QueryClient } from '@tanstack/react-query';
import { BroadcastChannel } from 'broadcast-channel';
import { createAuthApi } from './api';
import type { Account, PasswordInput, SignInInput } from './schemas';

type Status = 'loading' | 'anonymous' | 'authenticated' | 'restricted' | 'locked';
type Snapshot = {
  status: Status;
  account?: Account;
  generation: number;
  error?: string;
  notice?: string;
  retryAt: number;
  pending: boolean;
};
type SessionMessage = 'lock' | 'changed';

/** Better Auth owns session fetching/storage; this class enforces GRD teardown and lock policy. */
export class Session {
  private state: Snapshot = { status: 'loading', generation: 0, retryAt: 0, pending: false };
  private listeners = new Set<() => void>();
  private cleanups = new Set<() => void>();
  private checkPromise?: Promise<void>;
  private channel?: BroadcastChannel<SessionMessage>;
  private logoutRequested = false;
  private nextCheck = 0;
  private lastCheckWasEvent = false;
  private observing = false;
  private resetting = false;
  private clearedSnapshot?: unknown;
  private action = false;
  private readonly auth;

  constructor(
    readonly client: ApiClient,
    readonly queries: QueryClient,
  ) {
    this.auth = createAuthApi(client);
    client.onAuthError = (status) => {
      if (status === 401) this.expire();
      else void this.recheck();
    };
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** App composition registers stream cleanup here; auth does not own the connection. */
  registerCleanup(cleanup: () => void) {
    this.cleanups.add(cleanup);
    return () => {
      this.cleanups.delete(cleanup);
    };
  }

  private publish(patch: Partial<Snapshot>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private reset(status: Status, error?: string, clearAuth = true) {
    this.client.reset();
    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch {
        /* One failed consumer must not prevent cache/session teardown. */
      }
    }
    void this.queries.cancelQueries();
    this.queries.clear();
    this.checkPromise = undefined;
    this.resetting = true;
    if (clearAuth) this.clearedSnapshot = this.auth.clear();
    this.resetting = false;
    this.publish({
      status,
      account: undefined,
      generation: this.state.generation + 1,
      error,
      notice: undefined,
      pending: false,
    });
  }

  private broadcast(message: SessionMessage) {
    // Storage restrictions must not turn a completed auth mutation into a failure.
    void this.channel?.postMessage(message).catch(() => undefined);
  }

  start() {
    try {
      this.channel = new BroadcastChannel<SessionMessage>('grd-session-v1');
      this.channel.onmessage = (message) => {
        if (message !== 'lock' && message !== 'changed') return;
        this.logoutRequested = message === 'lock';
        this.reset(
          'locked',
          message === 'lock'
            ? 'Sign-out was requested in another tab. Retry to confirm it.'
            : undefined,
        );
        this.nextCheck = 0;
        if (message === 'changed') void this.recheck();
      };
    } catch {
      /* Focus revalidation remains available if browser storage is disabled. */
    }
    this.observing = true;
    const unsubscribe = this.auth.subscribe(() => this.observe());
    void this.recheck(false);
    return () => {
      this.observing = false;
      unsubscribe();
      const channel = this.channel;
      this.channel = undefined;
      if (channel) void channel.close().catch(() => undefined);
      this.nextCheck = 0;
      this.reset('loading', undefined, false);
    };
  }

  private accept(account: Account) {
    if (!account.active) {
      this.expire();
      return;
    }
    const previous = this.state.account;
    if (
      previous &&
      (previous.externalId !== account.externalId ||
        previous.role !== account.role ||
        previous.mustChangePassword !== account.mustChangePassword)
    ) {
      this.reset('loading', undefined, false);
    }
    this.publish({
      account,
      status: account.mustChangePassword ? 'restricted' : 'authenticated',
      error: undefined,
      retryAt: 0,
      pending: false,
    });
  }

  expire(notice = 'Your session has ended. Sign in again.') {
    this.logoutRequested = false;
    this.reset('anonymous');
    this.publish({ notice, retryAt: 0 });
  }

  private observe() {
    if (this.resetting || this.action || this.logoutRequested) return;
    const result = this.auth.read();
    if (result.snapshot === this.clearedSnapshot) return;
    this.publish({ pending: result.pending });
    if (result.pending) return;
    if (result.error instanceof SessionCancelled) return;
    if (result.error) {
      this.nextCheck = result.error.retryAt;
      this.reset('locked', result.error.message);
      this.publish({ retryAt: this.nextCheck });
    } else if (result.account) {
      this.accept(result.account);
    } else if (this.state.status !== 'anonymous') {
      this.expire(this.state.account ? undefined : (this.state.notice ?? ''));
    }
  }

  /** Better Auth performs the check; this coalesces app-level 403/SSE signals. */
  recheck = (authEvent = true): Promise<void> => {
    if (this.logoutRequested || this.action) return Promise.resolve();
    if (this.checkPromise) return this.checkPromise;
    if (
      Date.now() < this.nextCheck &&
      (!authEvent || this.lastCheckWasEvent || this.state.retryAt > Date.now())
    )
      return Promise.resolve();
    this.lastCheckWasEvent = authEvent;
    this.nextCheck = Date.now() + 2_000;
    const generation = this.state.generation;
    const promise = this.auth
      .recheck()
      .then(() => {
        if (!this.observing && generation === this.state.generation) this.observe();
      })
      .finally(() => {
        if (this.checkPromise === promise) this.checkPromise = undefined;
      });
    this.checkPromise = promise;
    return promise;
  };

  retry = async () => {
    if (Date.now() < this.state.retryAt) return;
    if (this.logoutRequested) await this.signOut();
    else {
      this.nextCheck = 0;
      await this.recheck();
    }
  };

  /** Re-read an edited own profile through Better Auth, including other open tabs. */
  async accountChanged() {
    // An older in-flight profile read must not consume the post-save refresh.
    const generation = this.state.generation;
    await this.checkPromise;
    if (generation !== this.state.generation) return;
    this.nextCheck = 0;
    await this.recheck(false);
    this.broadcast('changed');
  }

  async signIn(input: SignInInput) {
    if (this.action) return;
    this.action = true;
    this.logoutRequested = false;
    this.client.reset();
    this.queries.clear();
    this.publish({ notice: undefined });
    const generation = this.state.generation;
    try {
      const account = await this.auth.signIn(input);
      if (generation !== this.state.generation) throw new SessionCancelled();
      this.reset('loading', undefined, false);
      this.accept(account);
      this.broadcast('changed');
    } finally {
      this.action = false;
    }
  }

  async signOut() {
    if (this.action || Date.now() < this.state.retryAt) return;
    this.action = true;
    this.logoutRequested = true;
    this.reset('locked');
    this.publish({ pending: true });
    this.broadcast('lock');
    const generation = this.state.generation;
    try {
      await this.auth.signOut();
      if (generation !== this.state.generation) return;
      this.expire('You have signed out.');
      this.broadcast('changed');
    } catch (error) {
      if (generation !== this.state.generation || error instanceof SessionCancelled) return;
      const normalized = safeError(error);
      if (normalized.status === 401) {
        this.expire('You have signed out.');
        this.broadcast('changed');
      } else {
        this.publish({
          error: `Sign-out could not be confirmed. ${normalized.message}`,
          pending: false,
          retryAt: normalized.retryAt,
        });
      }
    } finally {
      this.action = false;
    }
  }

  async changePassword(input: PasswordInput) {
    if (this.action) return;
    this.action = true;
    const generation = this.state.generation;
    try {
      await this.auth.changePassword(input);
      if (generation !== this.state.generation) throw new SessionCancelled();
      this.expire('Password changed. Sign in with your new password.');
      this.broadcast('changed');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) this.expire();
      throw error;
    } finally {
      this.action = false;
    }
  }
}
