import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  const router = createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPendingMinMs: 0,
  });
  await router.load();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

it('shows an honest homepage without shipment records', async () => {
  await renderRoute('/');
  expect(await screen.findByRole('heading', { name: 'GRD Dashboard' })).toBeVisible();
  expect(screen.getByRole('img', { name: 'Global Resources Direct' })).toHaveAttribute(
    'src',
    '/brand/grd-logo.svg',
  );
  expect(screen.getByText(/Shipment information is not yet available/)).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('recovers from a nested unknown route using the keyboard', async () => {
  const user = userEvent.setup();
  await renderRoute('/missing/nested?source=test');
  expect(await screen.findByRole('heading', { name: 'Page not available' })).toBeVisible();
  await user.tab();
  expect(screen.getByRole('link', { name: 'Return home' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('heading', { name: 'GRD Dashboard' })).toBeVisible();
  expect(history.location.pathname).toBe('/');
});
