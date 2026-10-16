import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { expect, it, vi } from 'vitest';
import { ApiClient, SessionCancelled, safeError } from './api';

function failure(status: number, headers = {}) {
  return new AxiosError('sensitive server diagnostics', '', undefined, undefined, {
    status,
    statusText: '',
    data: { password: 'sensitive' },
    headers,
    config: {} as InternalAxiosRequestConfig,
  });
}

it('uses credentialed origin requests, JSON and empty 204 responses', async () => {
  const client = new ApiClient('http://localhost:3000');
  client.http.defaults.adapter = async (config) => {
    expect(config.baseURL).toBe('http://localhost:3000/api/v1');
    expect(config.withCredentials).toBe(true);
    expect(config.headers.get('Origin')).toBeUndefined();
    return {
      status: config.method === 'post' ? 204 : 200,
      statusText: '',
      headers: {},
      config,
      data: config.method === 'post' ? '' : { ok: true },
    };
  };
  expect(await client.request({ url: '/auth/me' })).toEqual({ ok: true });
  expect(await client.request({ url: '/auth/sign-out', method: 'POST', data: {} })).toBeUndefined();
});

it('discards responses from the previous session even when an adapter ignores cancellation', async () => {
  const client = new ApiClient('http://localhost:3000');
  let finish!: () => void;
  client.http.defaults.adapter = (config) =>
    new Promise((resolve) => {
      finish = () =>
        resolve({ status: 200, statusText: '', headers: {}, config, data: 'old account' });
    });
  const pending = client.request({ url: '/shipments' });
  client.reset();
  finish();
  await expect(pending).rejects.toBeInstanceOf(SessionCancelled);
});

it('handles query cancellation without reporting an auth failure', async () => {
  const client = new ApiClient('http://localhost:3000');
  const callback = vi.fn();
  client.onAuthError = callback;
  const controller = new AbortController();
  controller.abort();
  await expect(
    client.request({ url: '/shipments', signal: controller.signal }),
  ).rejects.toBeInstanceOf(SessionCancelled);
  expect(callback).not.toHaveBeenCalled();
});

it('reports business auth failures once per request but never retries mutations or intercepts login', async () => {
  const client = new ApiClient('http://localhost:3000');
  const adapter = vi.fn(async () => {
    throw failure(403);
  });
  client.http.defaults.adapter = adapter;
  client.onAuthError = vi.fn();
  await expect(client.request({ url: '/shipments', method: 'POST' })).rejects.toMatchObject({
    status: 403,
  });
  expect(adapter).toHaveBeenCalledOnce();
  expect(client.onAuthError).toHaveBeenCalledExactlyOnceWith(403);
  await expect(
    client.request({ url: '/auth/sign-in', auth: true, method: 'POST' }),
  ).rejects.toMatchObject({ status: 403 });
  expect(client.onAuthError).toHaveBeenCalledOnce();
});

it('normalizes unknown failures without retaining diagnostics or request bodies', () => {
  const error = safeError(failure(500));
  expect(error.message).toBe('The server could not complete the request. Try again.');
  expect(JSON.stringify(error)).not.toContain('sensitive');
  expect(safeError(new Error('secret')).message).not.toContain('secret');
});

it('respects numeric and HTTP-date Retry-After with a conservative fallback', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-16T00:00:00Z'));
  expect(safeError(failure(429, new AxiosHeaders({ 'retry-after': '12' }))).retryAt).toBe(
    Date.now() + 12_000,
  );
  expect(safeError(failure(429, { 'retry-after': 'Fri, 16 Oct 2026 00:02:00 GMT' })).retryAt).toBe(
    Date.now() + 120_000,
  );
  expect(safeError(failure(429)).retryAt).toBe(Date.now() + 60_000);
});
