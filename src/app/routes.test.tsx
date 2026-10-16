import { ApiClient } from '@api/api';
import { NotificationProvider } from '@components/feedback/notification-provider';
import { Session, SessionProvider } from '@features/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { accountFixture } from '@test/auth-fixture';
import { emptyShipments } from '@test/shipment-fixture';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrdThemeProvider } from '@theme/theme-provider';
import { enforceOptions } from 'broadcast-channel';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { routeTree } from './route-tree.gen';

let queryClient: QueryClient;
let history: ReturnType<typeof createMemoryHistory>;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  history = createMemoryHistory();
});

afterEach(async () => {
  cleanup();
  await queryClient.cancelQueries();
  queryClient.clear();
  history.destroy();
});

async function renderRoute(path: string) {
  history.replace(path);
  enforceOptions({ type: 'simulate' });
  const client = new ApiClient('http://localhost:3000');
  client.http.defaults.adapter = async (config) => ({
    data:
      config.url === '/shipments/search'
        ? emptyShipments
        : config.url === '/carriers'
          ? []
          : accountFixture,
    status: 200,
    statusText: '',
    headers: {},
    config,
  });
  const session = new Session(client, queryClient);
  const router = createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPendingMinMs: 0,
  });
  await router.load();
  render(
    <GrdThemeProvider>
      <NotificationProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider session={session}>
            <RouterProvider router={router} />
          </SessionProvider>
        </QueryClientProvider>
      </NotificationProvider>
    </GrdThemeProvider>,
  );
}

it('shows an honest branded overview without shipment records', async () => {
  await renderRoute('/');
  expect(await screen.findByRole('heading', { name: 'Overview' })).toBeVisible();
  const logo = screen.getAllByRole('img', { name: 'Global Resources Direct' }).at(0);
  expect(logo).toBeDefined();
  if (!logo) throw new Error('The GRD logo is missing.');
  expect(logo).toHaveAttribute('src', '/brand/grd-logo.svg');
  expect(screen.getByText(/No shipment data is being inferred or fabricated/)).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('navigates to the shipment list', async () => {
  const user = userEvent.setup();
  await renderRoute('/');
  const shipmentsLink = (await screen.findAllByRole('link', { name: 'Shipments' })).at(0);
  expect(shipmentsLink).toBeDefined();
  if (!shipmentsLink) throw new Error('The Shipments navigation link is missing.');
  await user.click(shipmentsLink);
  expect(await screen.findByRole('heading', { name: 'Shipments' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Apply filters' })).toBeVisible();
  expect(history.location.pathname).toBe('/shipments');
});

it('recovers from a nested unknown route using the keyboard', async () => {
  const user = userEvent.setup();
  await renderRoute('/missing/nested?source=test');
  expect(await screen.findByRole('heading', { name: 'Page not available' })).toBeVisible();
  screen.getByRole('link', { name: 'Return home' }).focus();
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('heading', { name: 'Overview' })).toBeVisible();
  expect(history.location.pathname).toBe('/');
});
