import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { getCarrierSettings } from '@features/carriers/api';
import { liveQuery } from '@features/tracking-updates';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useQuery } from '@tanstack/react-query';
import { createLink } from '@tanstack/react-router';

const RouterLink = createLink(Link);
export function CarriersPage() {
  const { session, account, status } = useSession();
  const mobile = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const query = useQuery({
    queryKey: ['carrier-settings'],
    queryFn: ({ signal }) => getCarrierSettings(session.client, signal),
    enabled: status === 'authenticated' && account?.role === 'admin',
    retry: false,
    ...liveQuery({ target: { kind: 'carriers' } }),
  });
  const link = (id: string, name: string) => (
    <RouterLink to="/admin/carriers/$carrierId" params={{ carrierId: id }}>
      {name}
    </RouterLink>
  );
  return (
    <Stack spacing={2} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <PageHeader
        title="Carriers"
        description="Manage carrier availability and tracking settings."
      />
      {query.isPending && <Typography role="status">Loading carriers…</Typography>}
      {query.isError && (
        <Alert
          severity={query.data ? 'warning' : 'error'}
          action={
            <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
              Retry
            </Button>
          }
        >
          Carrier settings could not refresh. {safeError(query.error).message}
        </Alert>
      )}
      {query.data?.length === 0 && <Typography>No carriers are available.</Typography>}
      {mobile
        ? query.data?.map((carrier) => (
            <Card variant="outlined" key={carrier.externalId}>
              <CardContent>
                {link(carrier.externalId, carrier.name)}
                <Typography>
                  {carrier.code} · {carrier.isActive ? 'Active' : 'Disabled'}
                </Typography>
                <Typography>
                  Fetch mode: {carrier.fetchMode} · Configured interval:{' '}
                  {carrier.pollIntervalMinutes} minutes
                </Typography>
              </CardContent>
            </Card>
          ))
        : query.data && (
            <Table aria-label="Carrier settings">
              <TableHead>
                <TableRow>
                  {['Carrier', 'Code', 'Status', 'Fetch mode', 'Configured interval'].map(
                    (label) => (
                      <TableCell key={label}>{label}</TableCell>
                    ),
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.map((carrier) => (
                  <TableRow key={carrier.externalId}>
                    <TableCell>{link(carrier.externalId, carrier.name)}</TableCell>
                    <TableCell>{carrier.code}</TableCell>
                    <TableCell>{carrier.isActive ? 'Active' : 'Disabled'}</TableCell>
                    <TableCell>{carrier.fetchMode}</TableCell>
                    <TableCell>{carrier.pollIntervalMinutes} minutes</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      <Typography variant="body2" color="text.secondary">
        Configured intervals are approximate. Carrier minimums, worker scheduling and rate limits
        can delay checks.
      </Typography>
    </Stack>
  );
}
