import { AppShell } from '@components/layout/app-shell';
import { AuthLayout } from '@features/auth/pages/auth-layout';
import { useRuntimeFeatures } from '@features/runtime-features';
import { LiveStatus } from '@features/tracking-updates';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import { useSession } from './context';
import { safeReturnTo } from './schemas';
import { useCooldown } from './use-cooldown';

export function SessionBoundary({ children }: { children: ReactNode }) {
  const { session, status, account, error, retryAt, pending } = useSession();
  const features = useRuntimeFeatures(session.client, status === 'authenticated');
  const quoteComparisonEnabled =
    features.isSuccess && !features.isError && features.data.quoteComparisonEnabled;
  const location = useLocation();
  const navigate = useNavigate();
  const remaining = useCooldown(retryAt);
  const login = location.pathname === '/login';
  const password = location.pathname === '/change-password';
  const returnTo = safeReturnTo(new URLSearchParams(location.searchStr).get('returnTo'));
  let destination: string | undefined;
  if (status === 'anonymous' && !login)
    destination = `/login?returnTo=${encodeURIComponent(password ? returnTo : safeReturnTo(location.href))}`;
  if (status === 'restricted' && !password)
    destination = `/change-password?returnTo=${encodeURIComponent(login ? returnTo : safeReturnTo(location.href))}`;
  if (status === 'authenticated' && login) destination = returnTo;

  useEffect(() => {
    if (destination) void navigate({ href: destination, replace: true });
  }, [destination, navigate]);

  if (status === 'locked')
    return (
      <AuthLayout title="Session locked">
        {error && <Alert severity="error">{error}</Alert>}
        {pending ? (
          <CircularProgress aria-label="Checking session" />
        ) : (
          <Button variant="contained" onClick={() => void session.retry()} disabled={remaining > 0}>
            {remaining > 0 ? `Retry in ${remaining}s` : 'Retry'}
          </Button>
        )}
      </AuthLayout>
    );
  if (status === 'loading' || destination)
    return (
      <AuthLayout title="Checking session">
        <CircularProgress aria-label="Checking session" />
      </AuthLayout>
    );
  if (login || password) return children;
  if (status !== 'authenticated' || !account) return null;
  const forbidden =
    (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) &&
    account.role !== 'admin';
  const quotePage =
    location.pathname === '/quotes' ||
    location.pathname.startsWith('/quotes/') ||
    location.pathname === '/admin/shipping-providers';
  return (
    <AppShell
      user={{ displayName: `${account.firstName} ${account.lastName}`, role: account.role }}
      onSignOut={() => void session.signOut()}
      quoteComparisonEnabled={quoteComparisonEnabled}
    >
      <LiveStatus />
      {quotePage && !quoteComparisonEnabled ? (
        features.isPending ? (
          <CircularProgress aria-label="Checking available pages" />
        ) : (
          <Stack spacing={2}>
            <Alert severity="warning">This page is not available in the current dashboard.</Alert>
            {features.isError && <Button onClick={() => void features.refetch()}>Retry</Button>}
            <Button component={Link} to="/">
              Return to dashboard
            </Button>
          </Stack>
        )
      ) : forbidden ? (
        <Stack spacing={2}>
          <Alert severity="error">You do not have permission to view this page.</Alert>
          <Button component={Link} to="/">
            Return to dashboard
          </Button>
        </Stack>
      ) : (
        children
      )}
    </AppShell>
  );
}
