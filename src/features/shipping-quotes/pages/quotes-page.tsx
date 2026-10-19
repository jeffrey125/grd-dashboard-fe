import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { listComparisons } from '@features/shipping-quotes/api';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createLink, useNavigate, useSearch } from '@tanstack/react-router';

const RouterButton = createLink(Button);

export function QuotesPage() {
  const { session } = useSession();
  const { page } = useSearch({ from: '/quotes/' });
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['quote-comparisons', page],
    queryFn: ({ signal }) => listComparisons(session.client, page, signal),
  });
  return (
    <>
      <PageHeader title="Quote comparisons" />
      <Stack spacing={2}>
        <RouterButton to="/quotes/new" search={{}} variant="contained">
          New comparison
        </RouterButton>
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
              <Typography>Saved — no rates run</Typography>
              <RouterButton to="/quotes/$comparisonId" params={{ comparisonId: item.externalId }}>
                View saved details
              </RouterButton>
            </Stack>
          </Paper>
        ))}
        <Stack direction="row" spacing={2}>
          <Button
            disabled={page === 1}
            onClick={() => void navigate({ to: '/quotes', search: { page: page - 1 } })}
          >
            Previous
          </Button>
          <Typography>
            Page {page} · {query.data?.total ?? '—'} comparisons
          </Typography>
          <Button
            disabled={!query.data || page * 25 >= query.data.total}
            onClick={() => void navigate({ to: '/quotes', search: { page: page + 1 } })}
          >
            Next
          </Button>
        </Stack>
      </Stack>
    </>
  );
}
