import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrdThemeProvider } from '@theme/theme-provider';
import { expect, it, vi } from 'vitest';

import { AppShell, type AppShellUser } from './app-shell';
import { PageHeader } from './page-header';

async function renderShell(user: AppShellUser, onSignOut = vi.fn()) {
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell user={user} onSignOut={onSignOut} quoteComparisonEnabled={true}>
        <Outlet />
      </AppShell>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <PageHeader title="Overview" />,
  });
  const history = createMemoryHistory({ initialEntries: ['/'] });
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]), history });
  await router.load();

  render(
    <GrdThemeProvider>
      <RouterProvider router={router} />
    </GrdThemeProvider>,
  );

  return { history, onSignOut };
}

it('keeps administration links out of the staff shell', async () => {
  await renderShell({ displayName: 'Jordan Staff', role: 'staff' });
  expect(screen.getAllByText('Jordan Staff').length).toBeGreaterThan(0);
  expect(screen.queryByRole('link', { name: 'Accounts' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Carriers' })).not.toBeInTheDocument();
});

it('expands shipment workflows by default with submenu icons and allows collapsing', async () => {
  const user = userEvent.setup();
  await renderShell({ displayName: 'Jordan Staff', role: 'staff' });

  const toggle = screen.getAllByRole('button', { name: 'Shipments' }).at(0);
  expect(toggle).toBeDefined();
  if (!toggle) throw new Error('The Shipments navigation toggle is missing.');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.queryAllByRole('link', { name: 'Shipments' })).toHaveLength(0);
  const monitoring = screen.getAllByRole('link', { name: 'Monitoring' }).at(0);
  const quotes = screen.getAllByRole('link', { name: 'Quote Compare' }).at(0);
  expect(monitoring?.querySelector('svg')).toBeInTheDocument();
  expect(quotes?.querySelector('svg')).toBeInTheDocument();

  await user.click(toggle);

  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryAllByRole('link', { name: 'Monitoring' })).toHaveLength(0);
  expect(screen.queryAllByRole('link', { name: 'Quote Compare' })).toHaveLength(0);
});

it('shows admin navigation and invokes the supplied sign-out slot', async () => {
  const user = userEvent.setup();
  const onSignOut = vi.fn();
  await renderShell({ displayName: 'Avery Admin', role: 'admin' }, onSignOut);

  expect(screen.getAllByRole('link', { name: 'Accounts' }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('link', { name: 'Carriers' }).length).toBeGreaterThan(0);
  const signOut = screen.getAllByRole('button', { name: 'Sign out' }).at(0);
  expect(signOut).toBeDefined();
  if (!signOut) throw new Error('The sign-out control is missing.');
  await user.click(signOut);
  expect(onSignOut).toHaveBeenCalledOnce();
});
