import { ApiClient, ApiError, SessionCancelled } from '@api/api';
import { QueryClient } from '@tanstack/react-query';
import { accountFixture } from '@test/auth-fixture';
import { enforceOptions } from 'broadcast-channel';
import { afterEach, expect, it, vi } from 'vitest';
import { Session } from './session';

const clients: QueryClient[] = [];
afterEach(() => {
  for (const client of clients) client.clear();
  clients.length = 0;
});
function setup() {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(queries);
  const client = new ApiClient('http://localhost:3000');
  const session = new Session(client, queries);
  const request = vi.spyOn(client, 'request').mockResolvedValue(accountFixture);
  return { queries, client, session, request };
}

it('restores profiles and deduplicates concurrent business/SSE rechecks with a cooldown', async () => {
  const { session, request } = setup();
  await Promise.all([session.recheck(), session.recheck(), session.recheck()]);
  expect(request).toHaveBeenCalledOnce();
  expect(session.getSnapshot().status).toBe('authenticated');
  await session.recheck();
  expect(request).toHaveBeenCalledOnce();
});

it('clears cached data, closes resources and rejects late auth restoration on expiry', async () => {
  const { session, request, queries } = setup();
  const cleanup = vi.fn();
  session.registerCleanup(cleanup);
  let finish!: (value: unknown) => void;
  request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  queries.setQueryData(['shipments'], ['private']);
  const pending = session.recheck();
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  session.expire();
  finish(accountFixture);
  await pending;
  expect(session.getSnapshot().status).toBe('anonymous');
  expect(queries.getQueryCache().getAll()).toHaveLength(0);
  expect(cleanup).toHaveBeenCalledOnce();
});

it('locks immediately on logout failure and retries revocation before restoring access', async () => {
  const { session, request, queries } = setup();
  await session.recheck();
  queries.setQueryData(['shipments'], ['private']);
  request.mockRejectedValueOnce(new ApiError(0, 'Offline'));
  await session.signOut();
  expect(session.getSnapshot()).toMatchObject({ status: 'locked', pending: false });
  expect(session.getSnapshot().error).toContain('Sign-out could not be confirmed');
  expect(queries.getQueryCache().getAll()).toHaveLength(0);
  await session.recheck();
  expect(request).toHaveBeenCalledTimes(2);
  request.mockResolvedValueOnce(undefined);
  await session.retry();
  expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/auth/sign-out' }));
  expect(session.getSnapshot().status).toBe('anonymous');
});

it('locks on network failure and backs off repeated rechecks including 429', async () => {
  const { session, request } = setup();
  request.mockRejectedValue(new ApiError(429, 'Wait', Date.now() + 60_000));
  await session.recheck();
  await session.retry();
  await session.recheck();
  expect(request).toHaveBeenCalledOnce();
  expect(session.getSnapshot()).toMatchObject({ status: 'locked', error: 'Wait' });
});

it('routes restricted sessions and treats password-change 204 as session revocation', async () => {
  const { session, request } = setup();
  request.mockResolvedValueOnce({ ...accountFixture, mustChangePassword: true });
  await session.recheck();
  expect(session.getSnapshot().status).toBe('restricted');
  request.mockResolvedValueOnce(undefined);
  await session.changePassword({
    currentPassword: 'issued',
    newPassword: 'chosen password',
    confirmPassword: 'chosen password',
  });
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: { currentPassword: 'issued', newPassword: 'chosen password' },
    }),
  );
  expect(session.getSnapshot()).toMatchObject({
    status: 'anonymous',
    notice: 'Password changed. Sign in with your new password.',
  });
});

it('rejects invalid response shapes and inactive profiles', async () => {
  const { session, request } = setup();
  request.mockResolvedValueOnce({ token: 'not a profile' });
  await session.recheck();
  expect(session.getSnapshot().status).toBe('locked');
  const other = setup();
  other.request.mockResolvedValueOnce({ ...accountFixture, active: false });
  await other.session.recheck();
  expect(other.session.getSnapshot().status).toBe('anonymous');
});

it('does not let a late login replace an expired session', async () => {
  const { session, request } = setup();
  let finish!: (value: unknown) => void;
  request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = session.signIn({ email: 'staff@example.test', password: 'secret' });
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  session.expire();
  finish(accountFixture);
  await expect(pending).rejects.toBeInstanceOf(SessionCancelled);
  expect(session.getSnapshot().status).toBe('anonymous');
});

it('rechecks the first business 403 immediately after focus restoration, without storms', async () => {
  const { session, client, request } = setup();
  await session.recheck(false);
  request.mockResolvedValueOnce({ ...accountFixture, mustChangePassword: true });
  client.onAuthError?.(403);
  client.onAuthError?.(403);
  await session.recheck();
  expect(request).toHaveBeenCalledTimes(2);
  expect(session.getSnapshot().status).toBe('restricted');
});

it('clears the previous account cache when a recheck observes a different principal', async () => {
  const { session, request, queries } = setup();
  await session.recheck(false);
  queries.setQueryData(['shipments'], ['previous account']);
  request.mockResolvedValueOnce({
    ...accountFixture,
    externalId: '22222222-2222-4222-8222-222222222222',
    role: 'admin',
  });
  await session.recheck();
  expect(queries.getQueryData(['shipments'])).toBeUndefined();
  expect(session.getSnapshot().account?.role).toBe('admin');
});

it('completes teardown even when a registered consumer throws', async () => {
  const { session, queries } = setup();
  await session.recheck();
  session.registerCleanup(() => {
    throw new Error('broken consumer');
  });
  const second = vi.fn();
  session.registerCleanup(second);
  session.expire();
  expect(second).toHaveBeenCalledOnce();
  expect(queries.getQueryCache().getAll()).toHaveLength(0);
  expect(session.getSnapshot().status).toBe('anonymous');
});

it('does not claim that a fresh visitor had an expired session', async () => {
  const { session, request } = setup();
  request.mockRejectedValueOnce(new ApiError(401, 'No session'));
  await session.recheck();
  expect(session.getSnapshot()).toMatchObject({ status: 'anonymous', notice: '' });
});

it('still clears protected data when revalidation discovers a revoked session', async () => {
  const { session, request, queries } = setup();
  await session.recheck(false);
  queries.setQueryData(['shipments'], ['private']);
  const generation = session.getSnapshot().generation;
  request.mockRejectedValueOnce(new ApiError(401, 'Revoked'));
  await session.recheck();
  expect(session.getSnapshot()).toMatchObject({
    status: 'anonymous',
    generation: generation + 1,
    notice: 'Your session has ended. Sign in again.',
  });
  expect(queries.getQueryCache().getAll()).toHaveLength(0);
});

it('keeps an observed outage locked until an authoritative retry succeeds', async () => {
  enforceOptions({ type: 'simulate' });
  const { session, request } = setup();
  request.mockRejectedValue(new ApiError(0, 'Offline'));
  const stop = session.start();
  try {
    await vi.waitFor(() => expect(session.getSnapshot().status).toBe('locked'));
    expect(session.getSnapshot().error).toBe('Offline');
    const calls = request.mock.calls.length;
    document.dispatchEvent(new Event('visibilitychange'));
    await session.recheck();
    expect(request).toHaveBeenCalledTimes(calls);
    expect(session.getSnapshot().status).toBe('locked');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_000);
    request.mockResolvedValue(accountFixture);
    await session.retry();
    expect(session.getSnapshot().status).toBe('authenticated');
  } finally {
    stop();
  }
});
