import { ApiError } from '@api/api';
import { accountFixture } from '@test/auth-fixture';
import { act, cleanup, render, screen } from '@testing-library/react';
import { enforceOptions } from 'broadcast-channel';
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { AppProviders } from './providers';
import { queryClient, router } from './router';
import { session } from './session';

// Isolate this singleton-router scenario from signed-out restoration tests.
it('opens only one stream after login despite resetting the transient UI generation', async () => {
  enforceOptions({ type: 'simulate' });
  const created = vi.fn();
  class Source extends EventTarget {
    readyState = 1;
    close() {
      this.readyState = 2;
    }
    constructor() {
      super();
      created();
    }
  }
  vi.stubGlobal('EventSource', Source);
  vi.spyOn(session.client, 'request').mockImplementation(async ({ url }) => {
    if (url === '/auth/sign-in') return accountFixture;
    throw new ApiError(401, 'No session');
  });
  try {
    await router.navigate({ to: '/login', search: { returnTo: '/' } });
    render(
      <StrictMode>
        <AppProviders />
      </StrictMode>,
    );
    await screen.findByRole('heading', { name: 'Sign in' });
    await act(() => session.signIn({ email: accountFixture.email, password: 'synthetic fixture' }));
    await screen.findByRole('heading', { name: 'Overview' });
    expect(created).toHaveBeenCalledOnce();
  } finally {
    cleanup();
    await queryClient.cancelQueries();
    queryClient.clear();
  }
});
