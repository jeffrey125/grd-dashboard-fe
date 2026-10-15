import { AppShell } from '@components/layout/app-shell';
import { PageHeader } from '@components/layout/page-header';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not available" />
      <Paper variant="outlined" sx={{ maxWidth: 640, p: { xs: 2, sm: 3 } }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This page is not available in the current dashboard.
        </Alert>
        <Button component={Link} to="/" variant="contained">
          Return home
        </Button>
      </Paper>
    </>
  );
}
