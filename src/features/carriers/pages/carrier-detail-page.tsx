import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { getCarrier } from '@features/carriers/api';
import { CarrierEditor } from '@features/carriers/carrier-editor';
import { settingLabels, settings } from '@features/carriers/schemas';
import { liveQuery } from '@features/tracking-updates';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useState } from 'react';

export function CarrierDetailPage() {
  const { carrierId } = useParams({ from: '/admin/carriers/$carrierId' });
  return <CarrierDetail key={carrierId} carrierId={carrierId} />;
}
function CarrierDetail({ carrierId }: { carrierId: string }) {
  const { session, status, account } = useSession();
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    queryKey: ['carrier-settings', carrierId],
    queryFn: ({ signal }) => getCarrier(session.client, carrierId, signal),
    enabled: status === 'authenticated' && account?.role === 'admin',
    retry: false,
    ...liveQuery({ target: { kind: 'carriers' } }),
  });
  const carrier = query.data;
  const blocked = query.isFetching || query.isError || query.errorUpdatedAt > query.dataUpdatedAt;
  return (
    <Stack spacing={2} sx={{ overflowWrap: 'anywhere', minWidth: 0 }}>
      <PageHeader
        title="Carrier settings"
        breadcrumbs={[
          { label: 'Carriers', href: '/admin/carriers' },
          { label: 'Carrier settings' },
        ]}
        actions={
          <Button component={Link} to="/admin/carriers">
            Back to carriers
          </Button>
        }
      />
      {query.isPending && <Typography role="status">Loading carrier settings…</Typography>}
      {query.isError && (
        <Alert
          severity={carrier ? 'warning' : 'error'}
          action={
            <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
              Retry
            </Button>
          }
        >
          Carrier settings could not refresh. {safeError(query.error).message}
        </Alert>
      )}
      {carrier && (
        <Paper component="section" variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography component="h2" variant="h6">
              {carrier.name}
            </Typography>
            <TextField
              label="Code"
              value={carrier.code}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="UUID"
              value={carrier.externalId}
              slotProps={{ input: { readOnly: true } }}
            />
            {carrier.autoDisabledReason === 'session_failures' && (
              <Alert severity="warning">
                Automatically disabled after repeated login or session-check failures. Resolve the
                connection or account issue, then edit the carrier and set Active to resume.
              </Alert>
            )}
            <Typography>
              Consecutive session failures: {carrier.consecutiveSessionFailures}
            </Typography>
            {editing ? (
              <CarrierEditor
                carrier={carrier}
                blocked={blocked}
                onClose={() => setEditing(false)}
              />
            ) : (
              <>
                <Box
                  component="dl"
                  sx={{
                    m: 0,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  {Object.entries(settings(carrier)).map(([key, value]) => (
                    <Box key={key}>
                      <Typography component="dt" color="text.secondary">
                        {settingLabels[key as keyof typeof settingLabels]}
                      </Typography>
                      <Typography component="dd" sx={{ m: 0 }}>
                        {value === null
                          ? 'Not set'
                          : typeof value === 'boolean'
                            ? value
                              ? key === 'isActive'
                                ? 'Active'
                                : 'Enabled'
                              : 'Disabled'
                            : value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Button
                  disabled={blocked || !['ups', 'echoship', 'ffe'].includes(carrier.code)}
                  onClick={() => setEditing(true)}
                >
                  Edit carrier
                </Button>
              </>
            )}
            <Typography variant="body2" color="text.secondary">
              Polling is approximate.{' '}
              {carrier.code === 'ups'
                ? 'UPS has a minimum interval of 30 minutes in production or 60 minutes in its test environment.'
                : 'EchoShip and FFE have a minimum interval of 5 minutes.'}{' '}
              The worker scans once per minute and processes carriers sequentially; rate limits and
              existing work may delay checks.
            </Typography>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
