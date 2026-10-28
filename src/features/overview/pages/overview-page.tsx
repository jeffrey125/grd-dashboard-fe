import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { MonitoringScopeToggle, useMonitoringScope } from '@features/monitoring-scope';
import { getOverview } from '@features/overview/api';
import type { Shipment } from '@features/shipments/contracts';
import { liveQuery } from '@features/tracking-updates';
import { businessTimestamp, parseCalendarDate } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createLink } from '@tanstack/react-router';

const RouterLink = createLink(Link);
const SummaryLink = createLink(CardActionArea);
const labels = {
  all: 'All shipments',
  active: 'Active',
  delivered: 'Delivered',
  attention: 'Needs attention',
  other: 'Other',
};

function attentionReason(row: Shipment) {
  return [
    row.latestLookup?.outcome === 'failed' && 'Latest tracking lookup failed',
    row.monitoringStatus === 'paused' &&
      (row.monitoringReason === 'not_found_threshold'
        ? 'Monitoring paused after repeated not-found results'
        : row.monitoringReason === 'failure_threshold'
          ? 'Monitoring paused after repeated lookup failures'
          : 'Monitoring paused manually'),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function OverviewPage() {
  const { session } = useSession();
  const { scope, accountId, setScope } = useMonitoringScope();
  const query = useQuery({
    queryKey: ['overview', accountId, scope],
    queryFn: ({ signal }) => getOverview(session.client, signal, scope),
    retry: false,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    ...liveQuery({ target: { kind: 'overview' }, carrierDependent: true }),
  });
  const data = query.data;
  return (
    <Stack spacing={3} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <PageHeader title="Overview" description="Operational shipment monitoring at a glance." />
      <MonitoringScopeToggle scope={scope} onChange={setScope} />
      {query.isError && (
        <Alert
          severity={data ? 'warning' : 'error'}
          action={
            <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
              Retry
            </Button>
          }
        >
          {data
            ? 'Overview may be stale. Showing the last successful refresh. '
            : 'Overview could not be loaded. '}
          {safeError(query.error).message}
        </Alert>
      )}
      {!data && query.isPending && <Typography role="status">Loading overview…</Typography>}
      {data && (
        <>
          <Typography variant="body2" color="text.secondary">
            Last successful refresh: {businessTimestamp(data.asOf)} · {data.timezone}. Refreshes
            every minute while visible and on live changes.
          </Typography>
          <Box
            aria-label="Shipment totals"
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(5, minmax(0, 1fr))',
              },
            }}
          >
            {(Object.keys(labels) as (keyof typeof labels)[]).map((tab) => (
              <Card key={tab} variant="outlined">
                <SummaryLink
                  to="/shipments"
                  search={{ tab }}
                  aria-label={`${labels[tab]}: ${data.counts[tab]}`}
                  sx={{ p: 2, height: '100%' }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {labels[tab]}
                  </Typography>
                  <Typography variant="h4" component="p">
                    {data.counts[tab].toLocaleString()}
                  </Typography>
                </SummaryLink>
              </Card>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Other contains manual shipments and can overlap Needs attention. Needs attention
            includes paused shipments and failed lookups. Delivered is the current completed count,
            not deliveries today.
          </Typography>
          <Paper
            component="section"
            aria-labelledby="attention-title"
            variant="outlined"
            sx={{ p: { xs: 2, md: 3 }, borderTop: 3, borderTopColor: 'warning.main' }}
          >
            <Stack spacing={2}>
              <Typography id="attention-title" component="h2" variant="h5">
                Needs attention
              </Typography>
              <Typography color="text.secondary">
                Paused monitoring and tracking problems, not a claim of late delivery.
              </Typography>
              <Typography variant="body2">
                Showing {data.attention.items.length} of {data.attention.total}
              </Typography>
              {!data.attention.total && <Typography>No shipments need attention.</Typography>}
              {data.attention.items.map((row) => (
                <Box
                  component="article"
                  key={row.externalId}
                  sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}
                >
                  <RouterLink
                    to="/shipments/$shipmentId"
                    params={{ shipmentId: row.externalId }}
                    search={{ returnTo: '/' }}
                  >
                    {row.trackingReference}
                  </RouterLink>
                  <Typography variant="body2">{row.carrier.name}</Typography>
                  <Typography>{attentionReason(row)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last known carrier status:{' '}
                    {row.currentTracking?.carrierStatus ?? 'Not available'}
                  </Typography>
                </Box>
              ))}
              <RouterLink to="/shipments" search={{ tab: 'attention' }}>
                View all needing attention
              </RouterLink>
            </Stack>
          </Paper>
          <Paper
            component="section"
            aria-labelledby="upcoming-title"
            variant="outlined"
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Stack spacing={2}>
              <Typography id="upcoming-title" component="h2" variant="h5">
                Upcoming deliveries
              </Typography>
              <Typography color="text.secondary">
                Undelivered shipments with estimated delivery from{' '}
                {parseCalendarDate(data.upcomingWindow.from).format('MMM D, YYYY')} through{' '}
                {parseCalendarDate(data.upcomingWindow.to).format('MMM D, YYYY')} (New York).
                Estimates may change.
              </Typography>
              <Typography variant="body2">
                Showing {data.upcomingDeliveries.items.length} of {data.upcomingDeliveries.total}
              </Typography>
              {!data.upcomingDeliveries.total && (
                <Typography>No upcoming deliveries in this date range.</Typography>
              )}
              {data.upcomingDeliveries.items.map((row) => (
                <Box
                  component="article"
                  key={row.externalId}
                  sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}
                >
                  <RouterLink
                    to="/shipments/$shipmentId"
                    params={{ shipmentId: row.externalId }}
                    search={{ returnTo: '/' }}
                  >
                    {row.trackingReference}
                  </RouterLink>
                  <Typography variant="body2">
                    {row.carrier.name}
                    {row.carrier.isActive ? '' : ' (disabled)'}
                  </Typography>
                  <Typography>
                    Estimated delivery:{' '}
                    {row.currentTracking?.estimatedDeliveryOn
                      ? parseCalendarDate(row.currentTracking.estimatedDeliveryOn).format(
                          'MMM D, YYYY',
                        )
                      : 'Not available'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last known carrier status:{' '}
                    {row.currentTracking?.carrierStatus ?? 'Not available'}
                  </Typography>
                </Box>
              ))}
              <RouterLink
                to="/shipments"
                search={{
                  tab: 'all',
                  estimatedDeliveryFrom: data.upcomingWindow.from,
                  estimatedDeliveryTo: data.upcomingWindow.to,
                  undeliveredOnly: 'true',
                  sortBy: 'estimatedDeliveryOn',
                  sortDirection: 'asc',
                }}
              >
                View all upcoming deliveries
              </RouterLink>
            </Stack>
          </Paper>
        </>
      )}
    </Stack>
  );
}
