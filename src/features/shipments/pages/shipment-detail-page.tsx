import { ApiError, SessionCancelled, safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import { useSession } from '@features/auth';
import { actionRules, useShipmentCommand } from '@features/shipments/actions';
import { deleteShipment, getSalesReps, getShipment } from '@features/shipments/api';
import { AssignmentSection } from '@features/shipments/assignment-section';
import {
  diagnosticMessage,
  monitoringLabel,
  verificationLink,
} from '@features/shipments/detail-model';
import { detailSearchSchema } from '@features/shipments/history-model';
import { HistorySection } from '@features/shipments/history-section';
import { MonitorAgainDialog } from '@features/shipments/monitor-again-dialog';
import { NotesSection } from '@features/shipments/notes-section';
import { RunPanel } from '@features/shipments/run-panel';
import type { TrackingRun } from '@features/shipments/schemas';
import { outcomes } from '@features/shipments/search-state';
import { liveQuery, useDisplayedRevision } from '@features/tracking-updates';
import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createLink, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useRef, useState } from 'react';

const RouterButton = createLink(Button);
function Fields({ values }: { values: Record<string, string> }) {
  return (
    <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
      {Object.entries(values).map(([label, value]) => (
        <Box key={label}>
          <Typography component="dt" variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography component="dd" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
function employeeName(employee: { firstName: string; lastName: string } | null) {
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Not attributed';
}
export function ShipmentDetailPage() {
  const { shipmentId } = useParams({ from: '/shipments/$shipmentId' });
  const { returnTo } = useSearch({ from: '/shipments/$shipmentId' });
  return <ShipmentDetail key={shipmentId} id={shipmentId.toLowerCase()} returnTo={returnTo} />;
}
function ShipmentDetail({ id, returnTo }: { id: string; returnTo: string }) {
  const search = useSearch({ from: '/shipments/$shipmentId' });
  const detailState = detailSearchSchema.safeParse(search);
  const { session } = useSession();
  const queries = useQueryClient();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const [missing, setMissing] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const [assignmentDirty, setAssignmentDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [monitorAgain, setMonitorAgain] = useState(false);
  const [requestedRun, setRequestedRun] = useState<TrackingRun | null>(null);
  const bypassNavigation = useRef(false);
  const deleting = useRef(false);
  const onMissing = useCallback(() => {
    setMissing(true);
  }, []);
  const query = useQuery({
    queryKey: ['shipment', id],
    queryFn: ({ signal }) => getShipment(session.client, id, signal),
    enabled: !missing,
    retry: false,
    ...liveQuery({
      target: { kind: 'shipment', externalId: id },
      carrierDependent: true,
      onMissing,
    }),
  });
  const command = useShipmentCommand(id, { onRefresh: setRequestedRun, onMissing });
  const notesPending = useIsMutating({ mutationKey: ['shipment-notes', id] }) > 0;
  const assignmentPending = useIsMutating({ mutationKey: ['shipment-assignment', id] }) > 0;
  const salesReps = useQuery({
    queryKey: ['sales-reps'],
    queryFn: ({ signal }) => getSalesReps(session.client, signal),
    staleTime: 5 * 60_000,
  });
  const removal = useMutation({
    mutationFn: () => deleteShipment(session.client, id),
    retry: false,
  });
  const row = query.data;
  const dirty = notesDirty || assignmentDirty;
  useDisplayedRevision(
    row?.currentTracking
      ? { shipmentId: id, snapshotId: row.currentTracking.externalId }
      : undefined,
    query.isSuccess &&
      !query.isFetching &&
      !missing &&
      detailState.success &&
      detailState.data.tab === 'overview',
  );
  const back = (
    <RouterButton to={returnTo} sx={{ alignSelf: 'flex-start' }}>
      {returnTo === '/' ? 'Back to Overview' : 'Back to results'}
    </RouterButton>
  );
  const remove = async () => {
    if (deleting.current || notesPending || command.pending) return;
    deleting.current = true;
    try {
      await removal.mutateAsync();
      bypassNavigation.current = true;
      setMissing(true);
      await queries.cancelQueries({ queryKey: ['shipment', id] });
      queries.removeQueries({ queryKey: ['shipment', id] });
      queries.removeQueries({ queryKey: ['history', id] });
      void queries.invalidateQueries({ queryKey: ['shipments'] });
      void queries.invalidateQueries({ queryKey: ['overview'] });
      showNotification({
        message: `${row?.trackingReference}: shipment deleted.`,
        severity: 'success',
      });
      await navigate({ to: returnTo, replace: true });
    } catch (error) {
      if (error instanceof SessionCancelled) return;
      if (safeError(error).status === 404) {
        setMissing(true);
        void queries.invalidateQueries({ queryKey: ['shipments'] });
        void queries.invalidateQueries({ queryKey: ['overview'] });
      }
      showNotification({ message: safeError(error).message, severity: 'error' });
    } finally {
      deleting.current = false;
    }
  };
  if (missing || (query.error instanceof ApiError && query.error.status === 404))
    return (
      <Stack spacing={2}>
        <Typography component="h1" variant="h1">
          Shipment unavailable
        </Typography>
        <Alert severity="info">This shipment is missing or has been deleted.</Alert>
        {back}
      </Stack>
    );
  if (!row)
    return (
      <Stack spacing={2}>
        <Typography component="h1" variant="h1">
          Shipment details
        </Typography>
        {query.isError ? (
          <Alert
            severity="error"
            action={<Button onClick={() => void query.refetch()}>Retry</Button>}
          >
            {safeError(query.error).message}
          </Alert>
        ) : (
          <Typography role="status">Loading shipment…</Typography>
        )}
        {back}
      </Stack>
    );
  const rules = actionRules(row);
  const verification = verificationLink(row.verificationUrl);
  const busy = command.pending || notesPending || assignmentPending || removal.isPending;
  const snapshot = row.currentTracking;
  return (
    <Stack spacing={3} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Stack component="header" spacing={1.5}>
        {back}
        <Typography component="h1" variant="h1">
          {row.trackingReference}
        </Typography>
        <Typography>
          {row.carrier.name} · {row.carrier.code.toUpperCase()}
        </Typography>
        <Chip
          sx={{ alignSelf: 'flex-start' }}
          label={monitoringLabel(row)}
          variant="outlined"
          color={
            row.monitoringStatus === 'active'
              ? 'info'
              : row.monitoringStatus === 'completed'
                ? 'success'
                : 'warning'
          }
        />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ flexWrap: 'wrap' }}>
          {verification && (
            <Button
              href={verification}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
            >
              Verify with carrier ↗
            </Button>
          )}
          {row.carrier.code !== 'other' && (
            <Button
              variant="contained"
              disabled={busy || !!rules.refresh}
              aria-describedby={rules.refresh ? 'refresh-reason' : undefined}
              onClick={() => command.execute(row, 'refresh')}
            >
              {row.monitoringReason === 'failure_threshold' ? 'Retry now' : 'Refresh'}
            </Button>
          )}
          {rules.pause && (
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() => command.execute(row, 'pause')}
            >
              Pause monitoring
            </Button>
          )}
          {rules.resume && (
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() => command.execute(row, 'resume')}
            >
              Resume monitoring
            </Button>
          )}
          {row.carrier.code !== 'other' && row.monitoringStatus === 'completed' && (
            <Button
              variant="outlined"
              disabled={busy || dirty}
              onClick={() => setMonitorAgain(true)}
            >
              Monitor again
            </Button>
          )}
          {monitorAgain && (
            <MonitorAgainDialog shipment={row} onClose={() => setMonitorAgain(false)} />
          )}
          <Button
            color="error"
            variant="outlined"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Delete shipment
          </Button>
        </Stack>
        {rules.refresh && (
          <Typography id="refresh-reason" variant="body2">
            {rules.refresh}
          </Typography>
        )}
        {!row.carrier.isActive && (
          <Alert severity="warning">
            {row.carrier.code === 'other'
              ? 'Other is disabled for new entries. This shipment remains editable.'
              : 'Carrier is disabled. Existing tracking remains available.'}
          </Alert>
        )}
        {query.isError && (
          <Alert
            severity="warning"
            action={<Button onClick={() => void query.refetch()}>Retry</Button>}
          >
            Showing previously loaded data. {safeError(query.error).message}
          </Alert>
        )}
      </Stack>
      <Tabs
        value={detailState.success ? detailState.data.tab : 'overview'}
        aria-label="Shipment detail tabs"
        onChange={(_event, tab: string) =>
          void navigate({
            from: '/shipments/$shipmentId',
            search: (current) => ({ ...current, tab }),
            resetScroll: false,
          })
        }
      >
        <Tab
          id="overview-tab"
          aria-controls="overview-panel"
          value="overview"
          label="Overview"
          disabled={notesPending || assignmentPending || removal.isPending}
        />
        <Tab
          id="audit-tab"
          aria-controls="audit-panel"
          value="audit"
          label="Audit"
          disabled={notesPending || assignmentPending || removal.isPending}
        />
        <Tab
          id="history-tab"
          aria-controls="history-panel"
          value="history"
          label="History"
          disabled={notesPending || assignmentPending || removal.isPending}
        />
      </Tabs>
      <Typography variant="caption" color="text.secondary">
        Times shown in America/New_York. Carrier dates remain date-only.
      </Typography>
      {!detailState.success ? (
        <Alert
          severity="error"
          action={
            <Button
              onClick={() =>
                void navigate({
                  from: '/shipments/$shipmentId',
                  search: { returnTo, tab: 'overview', page: '1', pageSize: '25' },
                  replace: true,
                  resetScroll: false,
                })
              }
            >
              Reset view
            </Button>
          }
        >
          Invalid detail URL: tab “{search.tab}”, page “{search.page}”, page size “{search.pageSize}
          ”. Choose Overview, Audit or History and a positive page with 25, 50, or 100 observations.
        </Alert>
      ) : (
        <>
          <Box
            role="tabpanel"
            id="history-panel"
            aria-labelledby="history-tab"
            hidden={detailState.data.tab !== 'history'}
          >
            {detailState.data.tab === 'history' && (
              <HistorySection
                key={`${id}:${detailState.data.page}:${detailState.data.pageSize}`}
                id={id}
                page={detailState.data.page}
                pageSize={detailState.data.pageSize}
                onMissing={onMissing}
              />
            )}
          </Box>
          <Box
            role="tabpanel"
            id="audit-panel"
            aria-labelledby="audit-tab"
            hidden={detailState.data.tab !== 'audit'}
          >
            <Stack spacing={3}>
              {requestedRun && (
                <RunPanel
                  key={requestedRun.externalId}
                  run={requestedRun}
                  shipmentId={id}
                  title={
                    requestedRun.externalId === row.latestRun?.externalId
                      ? 'Your refresh · Latest run'
                      : 'Your refresh'
                  }
                />
              )}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(3, minmax(0, 1fr))' },
                  gap: 2,
                  alignItems: 'stretch',
                  '& > section': { height: '100%', boxSizing: 'border-box' },
                }}
              >
                <Paper
                  component="section"
                  aria-labelledby="monitoring-title"
                  variant="outlined"
                  sx={{ p: 2 }}
                >
                  <Typography id="monitoring-title" component="h2" variant="h6" sx={{ mb: 2 }}>
                    Monitoring
                  </Typography>
                  {row.carrier.code === 'other' ? (
                    <Typography>
                      Updated manually by staff. Follow-up dates control Needs attention.
                    </Typography>
                  ) : (
                    <Fields
                      values={{
                        State: monitoringLabel(row),
                        'Last attempt': businessTimestamp(row.lastAttemptedAt),
                        'Next check': businessTimestamp(row.nextCheckAt),
                        'Consecutive not found': String(row.consecutiveNotFoundCount),
                        'Consecutive lookup failures': String(row.consecutiveFailureCount),
                      }}
                    />
                  )}
                  {row.monitoringReason === 'failure_threshold' && (
                    <Typography sx={{ mt: 2 }}>
                      Paused after repeated lookup failures. Retry now checks once. Monitoring
                      resumes only if tracking data is found; a failed or not-found result leaves it
                      paused.
                    </Typography>
                  )}
                  {row.monitoringReason === 'not_found_threshold' && (
                    <Typography sx={{ mt: 2 }}>
                      Paused after repeated not-found results. Use Refresh to check again;
                      monitoring can reactivate if the shipment is found.
                    </Typography>
                  )}
                  {row.monitoringStatus === 'active' && snapshot?.deliveredOn && (
                    <Typography sx={{ mt: 2 }}>
                      Delivered; checks continue until the start of {row.followUpOn} in New York
                      time.
                    </Typography>
                  )}
                  {row.carrier.code !== 'other' && row.monitoringStatus === 'completed' && (
                    <Typography sx={{ mt: 2 }}>
                      Monitoring has finished. Choose Monitor again and a future follow-up date to
                      restart carrier checks.
                    </Typography>
                  )}
                </Paper>
                {row.carrier.code !== 'other' && (
                  <Paper
                    component="section"
                    aria-labelledby="lookup-title"
                    variant="outlined"
                    sx={{ p: 2 }}
                  >
                    <Stack spacing={2}>
                      <Typography id="lookup-title" component="h2" variant="h6">
                        Latest lookup &amp; run
                      </Typography>
                      <Fields
                        values={{
                          'Latest completed lookup':
                            outcomes[row.latestLookup?.outcome ?? 'never_checked'],
                          'Lookup completed': businessTimestamp(
                            row.latestLookup?.completedAt ?? null,
                          ),
                        }}
                      />
                      {row.latestLookup && diagnosticMessage(row.latestLookup.reasonCode) && (
                        <Typography>{diagnosticMessage(row.latestLookup.reasonCode)}</Typography>
                      )}
                      <Typography variant="body2">
                        Run success describes processing. It does not confirm a found shipment or
                        delivery.
                      </Typography>
                      {row.latestRun && row.latestRun.externalId !== requestedRun?.externalId && (
                        <RunPanel
                          key={row.latestRun.externalId}
                          run={row.latestRun}
                          shipmentId={id}
                          title="Latest run"
                        />
                      )}
                      {!row.latestRun && !requestedRun && (
                        <Typography>No run available.</Typography>
                      )}
                    </Stack>
                  </Paper>
                )}
                <Paper
                  component="section"
                  aria-labelledby="audit-title"
                  variant="outlined"
                  sx={{ p: 2 }}
                >
                  <Typography id="audit-title" component="h2" variant="h6" sx={{ mb: 2 }}>
                    Shipment audit
                  </Typography>
                  <Fields
                    values={{
                      'Added by': employeeName(row.createdBy),
                      'Added at': businessTimestamp(row.createdAt),
                      'Last database update': businessTimestamp(row.updatedAt),
                      'Last database update by': employeeName(row.updatedBy),
                      'Record update': businessTimestamp(row.recordUpdatedAt),
                      'Record updated by': employeeName(row.recordUpdatedBy),
                    }}
                  />
                </Paper>
              </Box>
            </Stack>
          </Box>
          <Box
            role="tabpanel"
            id="overview-panel"
            aria-labelledby="overview-tab"
            hidden={detailState.data.tab !== 'overview'}
          >
            <Stack spacing={3}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                  alignItems: 'stretch',
                  '& > section': { height: '100%', boxSizing: 'border-box' },
                }}
              >
                <Paper
                  component="section"
                  aria-labelledby="tracking-title"
                  variant="outlined"
                  sx={{ p: 2 }}
                >
                  <Typography id="tracking-title" component="h2" variant="h6" sx={{ mb: 2 }}>
                    Tracking
                  </Typography>
                  {!snapshot && (
                    <Typography sx={{ mb: 2 }}>No tracking snapshot recorded yet.</Typography>
                  )}
                  {snapshot && row.latestLookup?.outcome === 'failed' && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      Latest lookup failed. Last known tracking is retained below.
                    </Alert>
                  )}
                  <Fields
                    values={{
                      'Carrier status': snapshot?.carrierStatus ?? 'Not available',
                      'Status detail': snapshot?.carrierStatusDetail ?? 'Not available',
                      Pickup: snapshot?.pickedUpOn ?? 'Not available',
                      'Estimated delivery': snapshot?.estimatedDeliveryOn ?? 'Not available',
                      'Actual delivery': snapshot?.deliveredOn ?? 'Not available',
                      'Snapshot recorded': businessTimestamp(snapshot?.observedAt ?? null),
                    }}
                  />
                </Paper>
                <Stack spacing={2} sx={{ height: '100%', '& > section': { flex: 1 } }}>
                  {salesReps.isError && (
                    <Alert severity="warning">
                      Sales Rep options could not refresh. The current assignment remains available.
                    </Alert>
                  )}
                  <AssignmentSection
                    shipment={row}
                    salesReps={salesReps.data ?? []}
                    disabled={command.pending || notesPending || removal.isPending || confirmDelete}
                    onMissing={onMissing}
                    onDirty={setAssignmentDirty}
                  />
                </Stack>
              </Box>{' '}
              {detailState.data.tab === 'overview' && (
                <NotesSection
                  shipment={row}
                  disabled={command.pending || removal.isPending || confirmDelete}
                  bypassNavigation={bypassNavigation}
                  onMissing={onMissing}
                  onDirty={setNotesDirty}
                />
              )}
            </Stack>
          </Box>
        </>
      )}
      <Dialog
        open={confirmDelete}
        onClose={() => {
          if (!removal.isPending) setConfirmDelete(false);
        }}
        aria-labelledby="delete-shipment-title"
      >
        <DialogTitle id="delete-shipment-title">Delete shipment?</DialogTitle>
        <DialogContent sx={{ overflowWrap: 'anywhere' }}>
          <Typography>
            {row.carrier.name} · {row.trackingReference}
          </Typography>
          <Typography>
            This removes the shipment from active views and stops future monitoring. There is no
            restore action in this app.
          </Typography>
          {dirty && (
            <Typography sx={{ mt: 2 }}>
              Your unsaved note changes will also be discarded. Assignment/follow-up changes will
              also be discarded.
            </Typography>
          )}
          {removal.isError && <Alert severity="error">{safeError(removal.error).message}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button autoFocus disabled={removal.isPending} onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button color="error" variant="outlined" disabled={busy} onClick={() => void remove()}>
            {removal.isPending ? 'Deleting…' : 'Delete shipment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
