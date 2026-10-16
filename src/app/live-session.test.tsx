import { ApiClient, ApiError } from '@api/api';
import { Session, SessionProvider, useSession } from '@features/auth';
import { liveQuery } from '@features/tracking-updates';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { accountFixture } from '@test/auth-fixture';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { enforceOptions } from 'broadcast-channel';
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { LiveSession } from './live-session';

it('attaches before protected fetches and isolates restriction/account changes under StrictMode', async () => {
  enforceOptions({ type: 'simulate' });
  const sources: Source[] = [];
  class Source extends EventTarget {
    readyState = 1;
    close = vi.fn(() => {
      this.readyState = 2;
    });
    constructor() {
      super();
      sources.push(this);
    }
  }
  vi.stubGlobal('EventSource', Source);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = new ApiClient('http://localhost:3000');
  const request = vi.spyOn(client, 'request').mockResolvedValue(accountFixture);
  const session = new Session(client, queries);
  const businessFetch = vi.fn(async () => {
    expect(sources.filter((source) => source.readyState !== 2)).toHaveLength(1);
    return session.getSnapshot().account?.externalId ?? 'missing';
  });
  function Protected() {
    const { data } = useQuery({
      queryKey: ['protected'],
      queryFn: businessFetch,
      ...liveQuery({ target: { kind: 'shipments' } }),
    });
    return <div>{data}</div>;
  }
  function Boundary() {
    const { status } = useSession();
    return status === 'authenticated' ? <Protected /> : <div>{status}</div>;
  }
  try {
    render(
      <StrictMode>
        <QueryClientProvider client={queries}>
          <SessionProvider session={session}>
            <LiveSession>
              <Boundary />
            </LiveSession>
          </SessionProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
    await screen.findByText(accountFixture.externalId);
    expect(sources.filter((source) => source.readyState !== 2)).toHaveLength(1);
    request.mockResolvedValueOnce({ ...accountFixture, mustChangePassword: true });
    await act(() => session.recheck());
    await screen.findByText('restricted');
    expect(sources.every((source) => source.readyState === 2)).toBe(true);
    expect(queries.getQueryData(['protected'])).toBeUndefined();
    const otherId = '22222222-2222-4222-8222-222222222222';
    request.mockResolvedValueOnce({ ...accountFixture, externalId: otherId });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_000);
    await act(() => session.recheck());
    await screen.findByText(otherId);
    expect(sources.filter((source) => source.readyState !== 2)).toHaveLength(1);
    const count = businessFetch.mock.calls.length;
    for (const source of sources.filter((source) => source.readyState === 2))
      source.dispatchEvent(new MessageEvent('resync', { data: '{}' }));
    expect(businessFetch).toHaveBeenCalledTimes(count);
    request.mockRejectedValueOnce(new ApiError(401, 'Revoked'));
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_000);
    await act(() => session.recheck());
    await screen.findByText('anonymous');
    await waitFor(() => expect(sources.every((source) => source.readyState === 2)).toBe(true));
  } finally {
    cleanup();
    await queries.cancelQueries();
    queries.clear();
  }
});
