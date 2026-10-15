import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
});

function NotFoundPage() {
  return (
    <main>
      <h1>Page not available</h1>
      <p>This page is not available in the current dashboard.</p>
      <Link to="/">Return home</Link>
    </main>
  );
}
