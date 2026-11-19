import { ApiError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { parseCalendarDate } from '@lib/dates';
import { useMediaQuery, useTheme } from '@mui/material';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getUpcoming, type UpcomingData, useUpcomingAccess } from './api';
import { DateNavigator, ShipmentCalendar } from './calendar';
import { OrderList, OrderPanel } from './order-panel';

export function UpcomingWeek() {
  return <UpcomingView mode="week" />;
}
export function UpcomingPage({ admin = false }: { admin?: boolean }) {
  return (
    <Stack spacing={3}>
      <PageHeader
        title={admin ? 'Shipment dispatch' : 'Upcoming shipments'}
        description="Requested ship dates from Airtable · America/Chicago"
      />
      <UpcomingView mode={admin ? 'admin' : 'month'} />
    </Stack>
  );
}

function UpcomingView({ mode }: { mode: 'week' | 'month' | 'admin' }) {
  const { session, account, status } = useSession();
  const access = useUpcomingAccess(session.client, account?.externalId, status === 'authenticated');
  const window = mode === 'week' ? 'week' : 'month';
  const query = useQuery({
    queryKey: [
      'upcoming-shipments',
      account?.externalId,
      window,
      access.data?.repIds.join(','),
      access.data?.from,
    ],
    queryFn: ({ signal }) => getUpcoming(session.client, window, signal),
    enabled: access.data?.enabled === true && status === 'authenticated',
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  });
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [rep, setRep] = useState('all');
  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      await getUpcoming(session.client, window, undefined, true);
      await client.invalidateQueries({ queryKey: ['upcoming-shipments'] });
      await access.refetch();
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };
  const forbidden = query.error instanceof ApiError && [401, 403].includes(query.error.status);
  if ((access.data && !access.data.enabled) || forbidden)
    return mode === 'week' ? null : (
      <Alert severity="info">
        Upcoming shipments are not assigned to your account. An Admin can configure access in
        Accounts.
      </Alert>
    );
  const data = query.data;
  if (!data) {
    if (mode === 'week' && !access.data?.enabled) return null;
    if (!query.isError && !access.isError) return <UpcomingSkeleton mode={mode} />;
    return (
      <Alert
        severity="error"
        action={
          <Button
            onClick={() => {
              void access.refetch();
              void query.refetch();
            }}
          >
            Retry
          </Button>
        }
      >
        Upcoming shipments could not be loaded.
      </Alert>
    );
  }
  const selectedRep =
    (rep === 'unassigned' && data.administrator) ||
    data.repFilterOptions.some((item) => item.id === rep)
      ? rep
      : 'all';
  const visibleOrders = data.orders.filter(
    (order) =>
      selectedRep === 'all' ||
      (selectedRep === 'unassigned' ? !order.repIds.length : order.repIds.includes(selectedRep)),
  );
  return (
    <Paper
      component="section"
      aria-label={mode === 'week' ? 'Upcoming shipments this week' : 'Upcoming shipment calendar'}
      variant="outlined"
      sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
        >
          <Box>
            <Typography component="h2" variant="h5">
              {mode === 'week'
                ? 'Upcoming shipments this week'
                : parseCalendarDate(data.from).format('MMMM YYYY')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {visibleOrders.length} orders · {parseCalendarDate(data.from).format('MMM D')}–
              {parseCalendarDate(data.through).format('MMM D')} · Chicago
            </Typography>
          </Box>
          <Button disabled={refreshing || query.isFetching} onClick={() => void refresh()}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Updated{' '}
          {new Date(data.updatedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })}{' '}
          (Chicago) · Cached for up to 5 minutes
        </Typography>
        {(data.stale || query.isError || access.isError || refreshError) && (
          <Alert severity="warning">
            Could not refresh Airtable. Showing the last successful data; dates or assignments may
            have changed.
          </Alert>
        )}
        <ShipmentViews
          key={`${mode}-${data.from}`}
          today={access.data?.from ?? data.from}
          data={data}
          mode={mode}
          rep={selectedRep}
          setRep={setRep}
        />
        {mode === 'week' && (
          <Button component={Link} to="/upcoming-shipments" variant="contained">
            Open monthly calendar
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

function UpcomingSkeleton({ mode }: { mode: 'week' | 'month' | 'admin' }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const animation = reducedMotion ? false : 'pulse';
  return (
    <Paper
      variant="outlined"
      role="status"
      aria-label="Loading upcoming shipments"
      aria-busy="true"
      sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}
    >
      <Stack spacing={2} aria-hidden="true">
        <Box>
          <Skeleton animation={animation} width="45%" height={32} />
          <Skeleton animation={animation} width="30%" height={20} />
        </Box>
        <Skeleton animation={animation} width="55%" height={20} />
        <Skeleton
          animation={animation}
          variant="rounded"
          width="100%"
          height={40}
          sx={{ maxWidth: 320 }}
        />
        {mode === 'month' ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1 }}>
            {Array.from({ length: 35 }, (_, index) => `placeholder-${index}`).map((id) => (
              <Skeleton key={id} animation={animation} variant="rounded" height={96} />
            ))}
          </Box>
        ) : (
          <>
            <Stack direction="row" spacing={1} sx={{ overflow: 'hidden' }}>
              {Array.from({ length: 7 }, (_, index) => `placeholder-${index}`).map((id) => (
                <Skeleton
                  key={id}
                  animation={animation}
                  variant="rounded"
                  width={72}
                  height={76}
                  sx={{ flexShrink: 0 }}
                />
              ))}
            </Stack>
            <Stack spacing={1} sx={{ height: mode === 'week' ? '34rem' : undefined }}>
              <Skeleton animation={animation} width={140} height={20} />
              {Array.from({ length: 5 }, (_, index) => `placeholder-${index}`).map((id) => (
                <Skeleton key={id} animation={animation} variant="rounded" height={94} />
              ))}
            </Stack>
          </>
        )}
        {mode === 'week' && <Skeleton animation={animation} variant="rounded" height={36} />}
      </Stack>
    </Paper>
  );
}

function ShipmentViews({
  data,
  today,
  mode,
  rep,
  setRep,
}: {
  data: UpcomingData;
  today: string;
  mode: 'week' | 'month' | 'admin';
  rep: string;
  setRep: (rep: string) => void;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const showRepFilter =
    data.administrator || (data.reps.length > 1 && data.repFilterOptions.length > 0);
  const [selected, setSelected] = useState<string | null>(
    mode === 'week' || mode === 'admin' ? null : today,
  );
  const [drawerDate, setDrawerDate] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const orders = data.orders.filter(
    (order) =>
      rep === 'all' || (rep === 'unassigned' ? !order.repIds.length : order.repIds.includes(rep)),
  );
  const selectedOrders = selected
    ? orders.filter((order) => order.requestedShipOn === selected)
    : orders;
  useEffect(() => {
    if (mobile) setDrawerDate(null);
    setOrderId(null);
  }, [mobile]);
  const close = () => {
    setDrawerDate(null);
    setOrderId(null);
  };
  return (
    <Stack spacing={2}>
      {showRepFilter && (
        <TextField
          select
          label="Sales rep"
          value={rep}
          onChange={(event) => {
            setRep(event.target.value);
            close();
          }}
          size="small"
          sx={{ maxWidth: 320 }}
        >
          <MenuItem value="all">All permitted reps</MenuItem>
          {data.repFilterOptions.map((item) => (
            <MenuItem value={item.id} key={item.id}>
              {item.name}
            </MenuItem>
          ))}
          {data.administrator && <MenuItem value="unassigned">Unassigned</MenuItem>}
        </TextField>
      )}
      {mode === 'month' ? (
        <>
          <ShipmentCalendar
            today={today}
            from={data.from}
            through={data.through}
            orders={orders}
            compact={mobile}
            selected={selected}
            onDate={(date) => {
              setSelected(date);
              if (!mobile) {
                setOrderId(null);
                setDrawerDate(date);
              }
            }}
          />
          {mobile && (
            <>
              <Typography component="h3" variant="h6">
                {parseCalendarDate(selected ?? data.from).format('dddd, MMM D')} ·{' '}
                {selectedOrders.length} orders
              </Typography>
              <OrderList orders={selectedOrders} onOrder={setOrderId} />
            </>
          )}
        </>
      ) : mode === 'admin' && mobile ? (
        <>
          <DateNavigator
            from={data.from}
            through={data.through}
            orders={orders}
            selected={selected}
            onDate={setSelected}
          />
          {[
            ...data.reps.map((item) => ({ id: item.id, name: item.name })),
            { id: 'unassigned', name: 'Unassigned' },
          ]
            .filter((item) => rep === 'all' || rep === item.id)
            .map((item) => {
              const rows = selectedOrders.filter((order) =>
                item.id === 'unassigned' ? !order.repIds.length : order.repIds.includes(item.id),
              );
              return (
                <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {item.name} · {rows.length}
                  </Typography>
                  <OrderList orders={rows} onOrder={setOrderId} />
                </Paper>
              );
            })}
        </>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'minmax(0,1fr)',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <DateNavigator
              from={data.from}
              through={data.through}
              orders={orders}
              selected={selected}
              onDate={setSelected}
            />
          </Box>
          <Box
            sx={
              mode === 'week'
                ? {
                    height: '34rem',
                    minWidth: 0,
                    overflowY: 'auto',
                    scrollbarGutter: 'stable',
                    pr: 0.5,
                  }
                : undefined
            }
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Showing {mode === 'week' ? Math.min(5, selectedOrders.length) : selectedOrders.length}{' '}
              of {selectedOrders.length} orders
            </Typography>
            <OrderList
              orders={mode === 'week' ? selectedOrders.slice(0, 5) : selectedOrders}
              onOrder={setOrderId}
            />
          </Box>
        </Box>
      )}
      <OrderPanel
        mobile={mobile}
        date={drawerDate}
        orderId={orderId}
        orders={orders}
        onOrder={setOrderId}
        onBack={() => setOrderId(null)}
        onClose={close}
      />
    </Stack>
  );
}
