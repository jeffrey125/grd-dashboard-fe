import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { listComparisons } from '@features/shipping-quotes/api';
import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createLink, useNavigate, useSearch } from '@tanstack/react-router';

const RouterButton = createLink(Button);

export function QuotesPage() {
  const { session, account } = useSession();
  const { page, deleted = false } = useSearch({ from: '/quotes/' });
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['quote-comparisons', page, deleted],
    queryFn: ({ signal }) => listComparisons(session.client, page, signal, deleted),
    enabled: !deleted || account?.role === 'admin',
    refetchInterval: 15000,
  });
  if (deleted && account?.role !== 'admin')
    return <Alert severity="error">Deleted history is admin-only.</Alert>;
  return (
    <>
      <PageHeader title="Quote comparisons" />
      <Stack spacing={2}>
        <RouterButton to="/quotes/new" search={{}} variant="contained">
          New comparison
        </RouterButton>
        {account?.role === 'admin' && (
          <Stack direction="row" spacing={1}>
            <RouterButton
              to="/quotes"
              search={{ page: 1 }}
              variant={!deleted ? 'contained' : 'outlined'}
            >
              Current history
            </RouterButton>
            <RouterButton
              to="/quotes"
              search={{ page: 1, deleted: true }}
              variant={deleted ? 'contained' : 'outlined'}
            >
              Deleted history
            </RouterButton>
          </Stack>
        )}
        {query.isPending && <Typography>Loading comparisons…</Typography>}
        {query.error && <Alert severity="error">{safeError(query.error).message}</Alert>}
        {query.data?.items.length === 0 && <Typography>No saved comparisons.</Typography>}
        {query.data?.items.map((item) => (
          <Paper key={item.externalId} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography>
                Ship {item.input.shipDate} · {item.input.destination.city},{' '}
                {item.input.destination.country}
              </Typography>
              <Typography>Saved: {businessTimestamp(item.createdAt)} ET</Typography>
              {item.deletedAt && (
                <Typography>Deleted: {businessTimestamp(item.deletedAt)} ET</Typography>
              )}
              {item.restoredAt && (
                <Typography>Restored: {businessTimestamp(item.restoredAt)} ET</Typography>
              )}
              <Typography>
                {item.status === 'saved' ? 'Saved — no rates run' : item.status}
              </Typography>
              <RouterButton to="/quotes/$comparisonId" params={{ comparisonId: item.externalId }}>
                View saved details
              </RouterButton>
            </Stack>
          </Paper>
        ))}
        <Stack direction="row" spacing={2}>
          <Button
            disabled={page === 1}
            onClick={() => void navigate({ to: '/quotes', search: { page: page - 1, deleted } })}
          >
            Previous
          </Button>
          <Typography>
            Page {page} · {query.data?.total ?? '—'} comparisons
          </Typography>
          <Button
            disabled={!query.data || page * 25 >= query.data.total}
            onClick={() => void navigate({ to: '/quotes', search: { page: page + 1, deleted } })}
          >
            Next
          </Button>
        </Stack>
      </Stack>
    </>
  );
}
