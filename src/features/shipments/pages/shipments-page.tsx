import { safeError } from '@api/api';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { getCarriers, searchShipments } from '@features/shipments/api';
import { SearchBox, ShipmentFilters } from '@features/shipments/filters';
import {
  changeSearch,
  type SearchState,
  searchErrors,
  searchSchema,
  tabs,
} from '@features/shipments/search-state';
import { ShipmentGrid } from '@features/shipments/shipment-grid';
import { liveQuery } from '@features/tracking-updates';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createLink, useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

const RouterButton = createLink(Button);

export function ShipmentsPage() {
  const [clearRevision, setClearRevision] = useState(0);
  const raw = useSearch({ from: '/shipments/' });
  const navigate = useNavigate({ from: '/shipments/' });
  const returnTo = useLocation({ select: (location) => location.href });
  const { session } = useSession();
  const parsed = searchSchema.safeParse(raw);
  const search = parsed.success ? parsed.data : undefined;
  const errors = searchErrors(raw);
  const update = useCallback(
    (next: SearchState, replace = false) => {
      void navigate({ to: '/shipments', search: next, replace });
    },
    [navigate],
  );
  const onSearch = useCallback((q: string) => update(changeSearch(raw, { q })), [raw, update]);
  const query = useQuery({
    queryKey: ['shipments', search ?? raw],
    queryFn: ({ signal }) => searchShipments(session.client, searchSchema.parse(raw), signal),
    enabled: !!search,
    placeholderData: keepPreviousData,
    ...liveQuery({ target: { kind: 'shipments' }, carrierDependent: true }),
  });
  const carriers = useQuery({
    queryKey: ['carriers'],
    queryFn: ({ signal }) => getCarriers(session.client, signal),
    ...liveQuery({ target: { kind: 'carriers' } }),
  });
  const data = search ? query.data : undefined;
  const tabLabel = (value: keyof typeof tabs, label: string) =>
    `${label} (${data && !query.isPlaceholderData ? data.tabCounts[value] : '—'})`;
  useEffect(() => {
    if (!search || !data || query.isPlaceholderData || query.isFetching || query.isError) return;
    const last = Math.max(1, Math.ceil(data.total / search.pageSize));
    if (search.page > last) update(changeSearch(raw, { page: String(last) }, false), true);
  }, [search, data, query.isPlaceholderData, query.isFetching, query.isError, raw, update]);
  // Live query results never key this form; URL navigation intentionally resets its draft.
  const filterKey = JSON.stringify(
    Object.fromEntries(
      Object.entries(raw).filter(
        ([key]) =>
          key !== 'q' &&
          (!['tab', 'page', 'pageSize', 'sortBy', 'sortDirection'].includes(key) ||
            Object.hasOwn(errors, key)),
      ),
    ),
  );
  return (
    <>
      <PageHeader
        title="Shipments"
        description="Search, monitor, and manage tracked shipments."
        breadcrumbs={[{ label: 'Overview', href: '/' }, { label: 'Shipments' }]}
        actions={
          <RouterButton to="/shipments/new" search={{ returnTo }} variant="contained">
            Add shipments
          </RouterButton>
        }
      />
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <SearchBox
              key={clearRevision}
              value={raw.q ?? ''}
              error={errors.q}
              onSearch={onSearch}
            />
            {!search && (
              <Alert severity="error">
                Results are paused. Correct the invalid URL values below or clear filters; no
                filters have been removed automatically.
              </Alert>
            )}
            {carriers.isError && (
              <Alert
                severity="warning"
                action={<Button onClick={() => void carriers.refetch()}>Retry carriers</Button>}
              >
                Carrier options could not refresh. Existing selections are retained.
              </Alert>
            )}
            <ShipmentFilters
              key={filterKey}
              raw={raw}
              carriers={carriers.data ?? []}
              onApply={update}
              onClear={() => {
                setClearRevision((value) => value + 1);
                update({
                  tab: search?.tab ?? 'active',
                  sortBy: search?.sortBy ?? 'createdAt',
                  sortDirection: search?.sortDirection ?? 'desc',
                  pageSize: String(search?.pageSize ?? 25),
                });
              }}
            />
            {raw.undeliveredOnly === 'true' && (
              <Chip
                label="Undelivered only"
                onDelete={() => update(changeSearch(raw, { undeliveredOnly: undefined }))}
                sx={{ alignSelf: 'flex-start' }}
              />
            )}
          </Stack>
        </Paper>
        <TextField
          select
          fullWidth
          label="Shipment view"
          value={search?.tab ?? ''}
          slotProps={{ select: { native: true } }}
          onChange={(event) => update(changeSearch(raw, { tab: event.target.value }))}
          sx={{ display: { xs: 'block', md: 'none' } }}
        >
          {!search?.tab && (
            <option value="" disabled>
              Choose a valid view
            </option>
          )}
          {Object.entries(tabs).map(([value, label]) => (
            <option key={value} value={value}>
              {tabLabel(value as keyof typeof tabs, label)}
            </option>
          ))}
        </TextField>
        <Tabs
          value={search?.tab ?? false}
          onChange={(_event, tab: string) => update(changeSearch(raw, { tab }))}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Shipment status"
          sx={{ display: { xs: 'none', md: 'flex' } }}
        >
          {Object.entries(tabs).map(([value, label]) => (
            <Tab key={value} value={value} label={tabLabel(value as keyof typeof tabs, label)} />
          ))}
        </Tabs>
        <Typography variant="caption">
          Needs attention overlaps other tabs. Timestamps: America/New_York. Carrier delivery dates
          are calendar dates.
        </Typography>
        {search && query.isError && (
          <Alert
            severity="error"
            action={<Button onClick={() => void query.refetch()}>Retry results</Button>}
          >
            {data ? 'Could not refresh. Displayed results may be stale. ' : ''}
            {safeError(query.error).message}
          </Alert>
        )}
        {search && query.isFetching && (
          <Typography role="status">
            {query.isPlaceholderData
              ? 'Loading requested results; previous results are shown and row actions are unavailable.'
              : data
                ? 'Updating results…'
                : 'Loading shipments…'}
          </Typography>
        )}
        {search && !query.isError && (!data || data.total > 0 || query.isFetching) && (
          <ShipmentGrid
            rows={data?.items ?? []}
            total={data?.total ?? 0}
            search={search}
            loading={query.isFetching && !data}
            placeholder={query.isPlaceholderData}
            returnTo={returnTo}
            onPage={(page, pageSize) =>
              update(changeSearch(raw, { page: String(page), pageSize: String(pageSize) }, false))
            }
            onSort={(sortBy, sortDirection) => update(changeSearch(raw, { sortBy, sortDirection }))}
          />
        )}
        {search && query.isError && data && (
          <ShipmentGrid
            rows={data.items}
            total={data.total}
            search={search}
            loading={false}
            placeholder={false}
            returnTo={returnTo}
            onPage={(page, pageSize) =>
              update(changeSearch(raw, { page: String(page), pageSize: String(pageSize) }, false))
            }
            onSort={(sortBy, sortDirection) => update(changeSearch(raw, { sortBy, sortDirection }))}
          />
        )}
        {search && data?.total === 0 && !query.isFetching && !query.isError && (
          <Alert severity="info">No shipments match. Change the tab or clear filters.</Alert>
        )}
      </Stack>
    </>
  );
}
