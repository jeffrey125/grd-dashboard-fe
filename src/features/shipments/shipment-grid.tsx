import { useTrackingReview } from '@features/tracking-updates';
import { businessTimestamp } from '@lib/dates';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { createLink, Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { actionRules, useShipmentCommand } from './actions';
import { followUpDue, followUpLabel, monitoringLabel, salesRepLabel } from './detail-model';
import type { Shipment } from './schemas';
import { type ShipmentSearch, sorts } from './search-state';

const RouterMenuItem = createLink(MenuItem);
const RouterButton = createLink(Button);
function needsAttention(row: Shipment) {
  return (
    row.monitoringStatus === 'paused' ||
    (row.monitoringStatus === 'active' && row.latestLookup?.outcome === 'failed') ||
    followUpDue(row.followUpOn)
  );
}
function RowActions({
  row,
  returnTo,
  disabled,
}: {
  row: Shipment;
  returnTo: string;
  disabled: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const mutation = useShipmentCommand(row.externalId);
  const rules = actionRules(row);
  const command = (value: 'pause' | 'resume' | 'refresh') => {
    setAnchor(null);
    mutation.execute(row, value);
  };
  return (
    <>
      <IconButton
        aria-label={`Actions for ${row.trackingReference}`}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(event) => setAnchor(event.currentTarget)}
        disabled={disabled || mutation.pending}
        size="small"
        sx={{ width: { xs: 44, md: 32 }, height: { xs: 44, md: 32 } }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        sx={{ zIndex: (theme) => theme.zIndex.snackbar + 1 }}
        anchorEl={anchor}
        open={!!anchor && !disabled}
        onClose={() => setAnchor(null)}
      >
        <RouterMenuItem
          to="/shipments/$shipmentId"
          params={{ shipmentId: row.externalId }}
          search={{ returnTo }}
        >
          View details
        </RouterMenuItem>
        <MenuItem disabled={!!rules.refresh || mutation.pending} onClick={() => command('refresh')}>
          <Stack>
            <span>Refresh</span>
            {rules.refresh && <Typography variant="caption">{rules.refresh}</Typography>}
            {!rules.refresh &&
              row.latestRun &&
              ['queued', 'running'].includes(row.latestRun.status) && (
                <Typography variant="caption">May join the queued or running refresh</Typography>
              )}
          </Stack>
        </MenuItem>
        {rules.pause && (
          <MenuItem disabled={mutation.pending} onClick={() => command('pause')}>
            Pause monitoring
          </MenuItem>
        )}
        {rules.resume && (
          <MenuItem disabled={mutation.pending} onClick={() => command('resume')}>
            Resume monitoring
          </MenuItem>
        )}
        {row.monitoringReason === 'not_found_threshold' && (
          <MenuItem disabled>Threshold pause: use Refresh to recheck</MenuItem>
        )}
      </Menu>
    </>
  );
}
function MobileActions({
  row,
  returnTo,
  disabled,
}: {
  row: Shipment;
  returnTo: string;
  disabled: boolean;
}) {
  const mutation = useShipmentCommand(row.externalId);
  const rules = actionRules(row);
  const unavailable = disabled || mutation.pending;
  const command = (value: 'pause' | 'resume' | 'refresh') => mutation.execute(row, value);
  const refreshNote =
    rules.refresh ??
    (row.latestRun && ['queued', 'running'].includes(row.latestRun.status)
      ? 'May join the queued or running refresh.'
      : undefined);
  return (
    <Stack spacing={0.75} sx={{ mt: 2 }} aria-label={`Actions for ${row.trackingReference}`}>
      <Stack spacing={1}>
        <RouterButton
          to="/shipments/$shipmentId"
          params={{ shipmentId: row.externalId }}
          search={{ returnTo }}
          variant="contained"
          size="small"
          fullWidth
          disabled={unavailable}
          sx={{ minHeight: 44 }}
        >
          View details
        </RouterButton>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          disabled={unavailable || !!rules.refresh}
          onClick={() => command('refresh')}
          sx={{ minHeight: 44 }}
        >
          Refresh
        </Button>
        {rules.pause && (
          <Button
            variant="outlined"
            size="small"
            fullWidth
            disabled={unavailable}
            onClick={() => command('pause')}
            sx={{ minHeight: 44 }}
          >
            Pause monitoring
          </Button>
        )}
        {rules.resume && (
          <Button
            variant="outlined"
            size="small"
            fullWidth
            disabled={unavailable}
            onClick={() => command('resume')}
            sx={{ minHeight: 44 }}
          >
            Resume monitoring
          </Button>
        )}
      </Stack>
      {refreshNote && (
        <Typography variant="caption" color="text.secondary">
          {refreshNote}
        </Typography>
      )}
      {row.monitoringReason === 'not_found_threshold' && (
        <Typography variant="caption" color="text.secondary">
          Threshold pause: use Refresh to recheck.
        </Typography>
      )}
    </Stack>
  );
}
export function ShipmentGrid({
  rows,
  total,
  search,
  loading,
  placeholder,
  returnTo,
  onPage,
  onSort,
}: {
  rows: Shipment[];
  total: number;
  search: ShipmentSearch;
  loading: boolean;
  placeholder: boolean;
  returnTo: string;
  onPage: (page: number, pageSize: number) => void;
  onSort: (field: string, direction: string) => void;
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { runtime, isUnseen } = useTrackingReview();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const openRow = useCallback(
    async (row: Shipment) => {
      const snapshotId = row.currentTracking?.externalId;
      if (runtime && snapshotId && isUnseen(row.externalId))
        await runtime.controller.acknowledge({ shipmentId: row.externalId, snapshotId });
      await navigate({
        to: '/shipments/$shipmentId',
        params: { shipmentId: row.externalId },
        search: { returnTo },
      });
    },
    [isUnseen, navigate, returnTo, runtime],
  );
  const sortModel = useMemo(
    () => [{ field: search.sortBy, sort: search.sortDirection }],
    [search.sortBy, search.sortDirection],
  );
  const columns = useMemo<GridColDef<Shipment>[]>(
    () => [
      {
        field: 'salesRep',
        headerName: 'Sales Rep',
        width: 130,
        sortable: false,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
            {salesRepLabel(row)}
          </Box>
        ),
      },
      {
        field: 'trackingReference',
        headerName: 'Tracking Number',
        width: 220,
        renderCell: ({ row }) => (
          <Stack sx={{ justifyContent: 'center', height: '100%', lineHeight: 1.4 }}>
            <Link
              to="/shipments/$shipmentId"
              params={{ shipmentId: row.externalId }}
              search={{ returnTo }}
              style={{ color: 'inherit' }}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                void openRow(row);
              }}
            >
              {row.trackingReference}
            </Link>
            {isUnseen(row.externalId) && (
              <Typography
                variant="caption"
                color={needsAttention(row) ? 'error.main' : 'success.main'}
                sx={{ fontWeight: 700 }}
              >
                ● {needsAttention(row) ? 'Needs attention' : 'Updated'}
              </Typography>
            )}
            <Typography variant="caption">
              {row.carrier.name}
              {row.carrier.isActive ? '' : ' — Carrier disabled'}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'carrierStatus',
        headerName: 'Carrier status',
        width: 180,
        sortable: false,
        valueGetter: (_value, row) => row.currentTracking?.carrierStatus ?? 'Not available',
      },
      {
        field: 'monitoringStatus',
        headerName: 'Monitoring',
        width: 190,
        sortable: false,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={
              row.monitoringStatus === 'active'
                ? 'info'
                : row.monitoringStatus === 'completed'
                  ? 'success'
                  : 'warning'
            }
            label={monitoringLabel(row)}
          />
        ),
      },
      {
        field: 'pickedUpOn',
        headerName: 'Pickup',
        width: 140,
        sortable: false,
        valueGetter: (_value, row) => row.currentTracking?.pickedUpOn ?? 'Not available',
      },
      {
        field: 'estimatedDeliveryOn',
        headerName: 'Delivery',
        width: 140,
        valueGetter: (_value, row) => row.currentTracking?.estimatedDeliveryOn ?? 'Not available',
      },
      {
        field: 'followUpOn',
        headerName: 'Follow Up',
        width: 150,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
            <Typography color={followUpDue(row.followUpOn) ? 'warning.main' : undefined}>
              {followUpLabel(row.followUpOn)}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'notes',
        headerName: 'Notes',
        width: 220,
        sortable: false,
        valueFormatter: (value: string | null) => value ?? 'No notes',
      },
      {
        field: 'createdAt',
        headerName: 'Date Created',
        width: 210,
        valueFormatter: (value: string) => businessTimestamp(value),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 85,
        sortable: false,
        disableColumnMenu: true,
        renderCell: ({ row }) => (
          <RowActions key={row.externalId} row={row} returnTo={returnTo} disabled={placeholder} />
        ),
      },
    ],
    [returnTo, placeholder, isUnseen, openRow],
  );
  if (mobile)
    return (
      <Stack spacing={2} aria-label="Shipment cards" aria-busy={loading}>
        <Stack direction="row" spacing={1}>
          <TextField
            select
            fullWidth
            label="Sort by"
            value={search.sortBy}
            slotProps={{ select: { native: true } }}
            onChange={(event) => onSort(event.target.value, search.sortDirection)}
          >
            {Object.entries(sorts).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            label="Sort direction"
            value={search.sortDirection}
            slotProps={{ select: { native: true } }}
            onChange={(event) => onSort(search.sortBy, event.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </TextField>
        </Stack>
        {rows.map((row) => (
          <Card
            key={row.externalId}
            component="article"
            variant="outlined"
            aria-label={`Shipment ${row.trackingReference}`}
            onClick={(event) => {
              const target = event.target;
              if (
                placeholder ||
                (target instanceof Element &&
                  target.closest('a, button, input, select, textarea, [role="menuitem"]'))
              )
                return;
              void openRow(row);
            }}
            sx={{
              overflowWrap: 'anywhere',
              cursor: placeholder ? 'default' : 'pointer',
              ...(isUnseen(row.externalId)
                ? {
                    borderColor: needsAttention(row) ? 'error.main' : 'success.main',
                    borderLeftWidth: 4,
                    bgcolor: needsAttention(row)
                      ? 'color-mix(in srgb, var(--grd-palette-error-main) 10%, transparent)'
                      : 'color-mix(in srgb, var(--grd-palette-success-main) 10%, transparent)',
                  }
                : {}),
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
                    <Link
                      to="/shipments/$shipmentId"
                      params={{ shipmentId: row.externalId }}
                      search={{ returnTo }}
                      style={{ color: 'inherit' }}
                      onClick={(event) => {
                        if (
                          event.button !== 0 ||
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return;
                        event.preventDefault();
                        void openRow(row);
                      }}
                    >
                      {row.trackingReference}
                    </Link>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {row.carrier.name}
                    {row.carrier.isActive ? '' : ' — Carrier disabled'}
                  </Typography>
                </Box>
              </Stack>
              {isUnseen(row.externalId) && (
                <Chip
                  size="small"
                  label={needsAttention(row) ? 'Needs attention' : 'Updated'}
                  color={needsAttention(row) ? 'error' : 'success'}
                  variant="outlined"
                  sx={{ mt: 1 }}
                />
              )}
              <Box
                component="dl"
                sx={{
                  m: 0,
                  mt: 2,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 1.5,
                }}
              >
                {Object.entries({
                  'Carrier status': row.currentTracking?.carrierStatus ?? 'Not available',
                  Monitoring: monitoringLabel(row),
                  'Sales Rep': salesRepLabel(row),
                  'Follow Up': followUpLabel(row.followUpOn),
                  Pickup: row.currentTracking?.pickedUpOn ?? 'Not available',
                  Delivery: row.currentTracking?.estimatedDeliveryOn ?? 'Not available',
                  Created: businessTimestamp(row.createdAt),
                }).map(([label, value]) => (
                  <Box key={label}>
                    <Typography component="dt" variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography component="dt" variant="caption" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                    {row.notes ?? 'No notes'}
                  </Typography>
                </Box>
              </Box>
              <MobileActions row={row} returnTo={returnTo} disabled={placeholder} />
            </CardContent>
          </Card>
        ))}
        <TablePagination
          component="div"
          count={total}
          page={search.page - 1}
          rowsPerPage={search.pageSize}
          rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(_event, page) => onPage(page + 1, search.pageSize)}
          onRowsPerPageChange={(event) => onPage(1, Number(event.target.value))}
          sx={{
            overflow: 'visible',
            '& .MuiTablePagination-toolbar': {
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              px: 0,
            },
            '& .MuiIconButton-root': { width: 44, height: 44 },
          }}
        />
      </Stack>
    );
  return (
    <Box sx={{ width: '100%', minWidth: 0, height: 620 }}>
      <DataGrid
        slotProps={{
          footer: { sx: { minHeight: { xs: 104, sm: 52 } } },
          basePagination: {
            material: {
              sx: {
                maxHeight: 'none',
                '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', justifyContent: 'flex-end' },
                '& .MuiTablePagination-selectLabel': { display: 'block' },
                '& .MuiTablePagination-input': { display: 'inline-flex' },
              },
            },
          },
        }}
        aria-label="Shipments"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.externalId}
        getRowClassName={({ row }) =>
          isUnseen(row.externalId)
            ? needsAttention(row)
              ? 'tracking-needs-attention'
              : 'tracking-updated'
            : ''
        }
        rowHeight={64}
        rowCount={total}
        loading={loading}
        paginationMode="server"
        sortingMode="server"
        filterMode="server"
        disableColumnFilter
        disableRowSelectionOnClick
        disableColumnMenu
        onRowClick={({ row }, event) => {
          const target = event.target;
          if (
            placeholder ||
            (target instanceof Element &&
              target.closest('a, button, input, select, textarea, [role="menuitem"]'))
          )
            return;
          void openRow(row);
        }}
        pageSizeOptions={[25, 50, 100]}
        paginationModel={{ page: search.page - 1, pageSize: search.pageSize }}
        onPaginationModelChange={(model) => {
          if (model.page !== search.page - 1 || model.pageSize !== search.pageSize)
            onPage(model.pageSize === search.pageSize ? model.page + 1 : 1, model.pageSize);
        }}
        sortModel={sortModel}
        sortingOrder={['asc', 'desc']}
        onSortModelChange={(model) => {
          const sort = model[0];
          if (sort && sort.field in sorts && sort.sort) onSort(sort.field, sort.sort);
        }}
        localeText={{ noRowsLabel: 'No shipments match. Change the tab or clear filters.' }}
        sx={{
          bgcolor: 'background.paper',
          '& .MuiDataGrid-cell:focus-within': { outlineOffset: -2 },
          '& .MuiDataGrid-row': { cursor: placeholder ? 'default' : 'pointer' },
          '& .tracking-updated': {
            boxShadow: (theme) => `inset 4px 0 ${theme.vars.palette.success.main}`,
            bgcolor: 'color-mix(in srgb, var(--grd-palette-success-main) 10%, transparent)',
          },
          '& .tracking-needs-attention': {
            boxShadow: (theme) => `inset 4px 0 ${theme.vars.palette.error.main}`,
            bgcolor: 'color-mix(in srgb, var(--grd-palette-error-main) 10%, transparent)',
          },
        }}
      />
    </Box>
  );
}
