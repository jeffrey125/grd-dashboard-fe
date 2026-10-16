import { ApiError } from '@api/api';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enforceOptions } from 'broadcast-channel';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from './providers';
import { queryClient, router } from './router';
import { session } from './session';

afterEach(async () => {
  cleanup();
  await queryClient.cancelQueries();
  queryClient.clear();
});

it('preserves the sign-in draft when refocusing confirms the browser is still signed out', async () => {
  enforceOptions({ type: 'simulate' });
  const request = vi
    .spyOn(session.client, 'request')
    .mockRejectedValue(new ApiError(401, 'No session'));
  let now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  await router.navigate({ to: '/login', search: { returnTo: '/' } });
  render(
    <StrictMode>
      <AppProviders />
    </StrictMode>,
  );
  await screen.findByRole('heading', { name: 'Sign in' });
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email', { exact: true }), 'draft@example.test');
  await user.type(screen.getByLabelText('Password', { exact: true }), 'synthetic draft');
  const generation = session.getSnapshot().generation;
  const calls = request.mock.calls.length;
  now += 6_000;
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(calls + 1));
  await waitFor(() => expect(session.getSnapshot().pending).toBe(false));
  expect(session.getSnapshot().generation).toBe(generation);
  expect((screen.getByLabelText('Email', { exact: true }) as HTMLInputElement).value.length).toBe(
    18,
  );
  expect(
    (screen.getByLabelText('Password', { exact: true }) as HTMLInputElement).value.length,
  ).toBe(15);
});
