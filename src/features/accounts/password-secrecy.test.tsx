import { ApiClient } from '@api/api';
import { routeTree } from '@app/route-tree.gen';
import { NotificationProvider } from '@components/feedback/notification-provider';
import { Session, SessionProvider } from '@features/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { accountFixture } from '@test/auth-fixture';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrdThemeProvider } from '@theme/theme-provider';
import { enforceOptions } from 'broadcast-channel';
import { afterEach, expect, it } from 'vitest';

let queries: QueryClient;
let history: ReturnType<typeof createMemoryHistory>;
afterEach(async () => {
  cleanup();
  await queries?.cancelQueries();
  queries?.clear();
  history?.destroy();
});

async function setup(path: string) {
  enforceOptions({ type: 'simulate' });
  queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  history = createMemoryHistory({ initialEntries: [path] });
  const client = new ApiClient('http://localhost:3000');
  const actor = {
    ...accountFixture,
    externalId: '33333333-3333-4333-8333-333333333333',
    role: 'admin',
  };
  let finish: (() => void) | undefined;
  let submitted = false;
  client.http.defaults.adapter = async (config) => {
    if (config.method === 'post') {
      submitted = true;
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    }
    return {
      config,
      status: config.url?.endsWith('/password') ? 204 : 200,
      statusText: '',
      headers: {},
      data: config.url === '/auth/me' ? actor : accountFixture,
    };
  };
  const session = new Session(client, queries);
  const router = createRouter({
    routeTree,
    history,
    context: { queryClient: queries },
    defaultPendingMinMs: 0,
  });
  await router.load();
  render(
    <GrdThemeProvider>
      <QueryClientProvider client={queries}>
        <SessionProvider session={session}>
          <NotificationProvider>
            <RouterProvider router={router} />
          </NotificationProvider>
        </SessionProvider>
      </QueryClientProvider>
    </GrdThemeProvider>,
  );
  return {
    submitted: () => submitted,
    finish: async () => {
      await act(async () => finish?.());
    },
  };
}
function expectNoSecret(secret: string) {
  expect(queries.getMutationCache().getAll()).toHaveLength(0);
  expect(
    JSON.stringify(
      queries
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
    ),
  ).not.toContain(secret);
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(secret);
  expect(history.location.href).not.toContain(secret);
}

it('keeps creation passwords outside shared query/mutation caches while pending and after success', async () => {
  const state = await setup('/admin/accounts/new');
  const user = userEvent.setup();
  const form = within(await screen.findByRole('form', { name: 'Create account' }));
  const secret = 'test-only issued password';
  await user.type(form.getByLabelText('First name', { exact: true }), 'New');
  await user.type(form.getByLabelText('Last name', { exact: true }), 'Employee');
  await user.type(form.getByLabelText('Email', { exact: true }), 'new@example.test');
  await user.type(form.getByLabelText('Issued password', { exact: true }), secret);
  await user.type(form.getByLabelText('Confirm issued password', { exact: true }), secret);
  await user.click(form.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(state.submitted()).toBe(true));
  expectNoSecret(secret);
  await state.finish();
  await screen.findByRole('heading', { name: 'Account details' });
  expectNoSecret(secret);
  expect(screen.queryByDisplayValue(secret)).not.toBeInTheDocument();
});

it('keeps reset passwords outside caches and clears the form after completion', async () => {
  const state = await setup(`/admin/accounts/${accountFixture.externalId}`);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Reset password' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Reset password' }));
  const secret = 'test-only reset password';
  await user.type(dialog.getByLabelText('Issued password', { exact: true }), secret);
  await user.type(dialog.getByLabelText('Confirm issued password', { exact: true }), secret);
  await user.click(dialog.getByRole('button', { name: 'Confirm password reset' }));
  await waitFor(() => expect(state.submitted()).toBe(true));
  expectNoSecret(secret);
  await state.finish();
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Reset password' })).not.toBeInTheDocument(),
  );
  expectNoSecret(secret);
  expect(screen.queryByDisplayValue(secret)).not.toBeInTheDocument();
});
