import { ApiError, safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { AccessActions } from '@features/accounts/access-actions';
import { AccountEditor } from '@features/accounts/account-editor';
import { getAccount } from '@features/accounts/api';
import { useSession } from '@features/auth';
import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useState } from 'react';

export function AccountDetailPage() {
  const { accountId } = useParams({ from: '/admin/accounts/$accountId' });
  return <AccountDetail key={accountId} accountId={accountId} />;
}
function AccountDetail({ accountId }: { accountId: string }) {
  const { session, account: actor, status } = useSession();
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    queryKey: ['accounts', accountId],
    queryFn: ({ signal }) => getAccount(session.client, accountId, signal),
    enabled: status === 'authenticated' && actor?.role === 'admin',
    retry: false,
    staleTime: 0,
  });
  const inaccessible =
    query.error instanceof ApiError && [401, 403, 404].includes(query.error.status);
  const account = inaccessible ? undefined : query.data;
  return (
    <Stack spacing={2}>
      <PageHeader
        title="Account details"
        breadcrumbs={[{ label: 'Accounts', href: '/admin/accounts' }, { label: 'Account details' }]}
        actions={
          <Button component={Link} to="/admin/accounts">
            Back to accounts
          </Button>
        }
      />
      {query.isPending && <CircularProgress aria-label="Loading account" />}
      {query.error && (
        <Alert
          severity={account ? 'warning' : 'error'}
          action={
            <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
              Retry
            </Button>
          }
        >
          {account ? 'Account refresh failed. Displaying the last loaded values. ' : ''}
          {safeError(query.error).message}
        </Alert>
      )}
      {account && (
        <>
          <Paper
            component="section"
            variant="outlined"
            sx={{ p: 2, overflowWrap: 'anywhere' }}
            aria-labelledby="account-profile-title"
          >
            <Stack spacing={2}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography component="h2" variant="h6" id="account-profile-title">
                  Profile{actor?.externalId === account.externalId ? ' (you)' : ''}
                </Typography>
                {!editing && <Button onClick={() => setEditing(true)}>Edit account</Button>}
              </Stack>
              {editing ? (
                <AccountEditor account={account} onClose={() => setEditing(false)} />
              ) : (
                <Box
                  component="dl"
                  sx={{
                    m: 0,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  {Object.entries({
                    'First name': account.firstName,
                    'Last name': account.lastName,
                    Email: account.email,
                    Role: account.role === 'admin' ? 'Admin' : 'Staff',
                    Status: account.active ? 'Active' : 'Inactive',
                    'Password replacement': account.mustChangePassword
                      ? 'Required at next sign-in'
                      : 'Not required',
                    'Created (New York)': businessTimestamp(account.createdAt),
                    'Updated (New York)': businessTimestamp(account.updatedAt),
                  }).map(([label, value]) => (
                    <Box key={label}>
                      <Typography component="dt" variant="body2" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography component="dd" sx={{ m: 0 }}>
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Stack>
          </Paper>
          <AccessActions account={account} disabled={editing} />
        </>
      )}
    </Stack>
  );
}
