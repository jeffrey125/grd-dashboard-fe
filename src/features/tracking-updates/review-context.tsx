import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import { useLocation } from '@tanstack/react-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { LiveUpdates } from './live-updates';
import { type DisplayedRevision, type ReadCurrent, ReviewController } from './review-controller';
import { hasUnseen, ReviewStore } from './review-store';
import { TrackingSound } from './sound';

type Runtime = { store: ReviewStore; controller: ReviewController; sound: TrackingSound };
const ReviewContext = createContext<Runtime | null>(null);
const noSubscribe = () => () => undefined;
const emptyView: ReturnType<ReviewStore['getSnapshot']> = {
  version: 1,
  records: {},
  sound: false,
  warning: '',
  sounded: [],
};

export function TrackingReviewProvider({
  accountId,
  live,
  readCurrent,
  isMissing,
  children,
}: {
  accountId: string;
  live: LiveUpdates;
  readCurrent: ReadCurrent;
  isMissing: (error: unknown) => boolean;
  children: ReactNode;
}) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [soundMessage, setSoundMessage] = useState('');
  useEffect(() => {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      /* In-memory review fallback. */
    }
    const store = new ReviewStore(accountId, storage, navigator.locks);
    store.connect();
    const controller = new ReviewController(store, readCurrent, isMissing);
    const sound = new TrackingSound(store, setSoundMessage);
    const unsubscribe = live.onEvent(controller.event);
    // Persisted pending identities reconcile quietly even if the stream resynced before mounting.
    controller.event({ type: 'resync' });
    setRuntime({ store, controller, sound });
    return () => {
      unsubscribe();
      controller.stop();
      sound.stop();
      store.stop();
    };
  }, [accountId, live, readCurrent, isMissing]);
  if (!runtime) return null;
  return (
    <ReviewContext.Provider value={runtime}>
      <TrackingAlerts runtime={runtime} />
      {soundMessage && (
        <Alert severity="warning" role="status">
          {soundMessage}
        </Alert>
      )}
      {children}
    </ReviewContext.Provider>
  );
}

function TrackingAlerts({ runtime }: { runtime: Runtime }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const path = useRef(pathname);
  path.current = pathname;
  const state = useSyncExternalStore(runtime.store.subscribe, runtime.store.getSnapshot);
  const [summary, setSummary] = useState('');
  useEffect(() => {
    runtime.sound.reconcile(pathname === '/shipments' && state.sound);
    if (pathname !== '/shipments') setSummary('');
  }, [runtime, pathname, state.sound]);
  useEffect(() => {
    if (pathname !== '/shipments') return;
    const pending = new Map<string, string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = runtime.store.onAlert(({ shipmentId, snapshotId }) => {
      if (path.current !== '/shipments') return;
      pending.set(shipmentId, snapshotId);
      timer ??= setTimeout(() => {
        timer = undefined;
        if (path.current === '/shipments') {
          const count = pending.size;
          setSummary(
            `${count} shipment${count === 1 ? '' : 's'} updated. Updates may be outside this view.`,
          );
          void runtime.sound.play([...pending.values()], () => path.current === '/shipments');
        }
        pending.clear();
      }, 2_000);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [runtime, pathname]);
  return (
    <Snackbar
      open={pathname === '/shipments' && !!summary}
      autoHideDuration={6_000}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      onClose={(_event, reason) => {
        if (reason !== 'clickaway') setSummary('');
      }}
    >
      <Alert severity="info" variant="filled" onClose={() => setSummary('')}>
        {summary}
      </Alert>
    </Snackbar>
  );
}

export function useTrackingReview() {
  const runtime = useContext(ReviewContext);
  const state = useSyncExternalStore(
    runtime?.store.subscribe ?? noSubscribe,
    runtime?.store.getSnapshot ?? (() => emptyView),
  );
  const isUnseen = useCallback((id: string) => hasUnseen(state.records[id]), [state.records]);
  return { runtime, state, isUnseen };
}

export function ReviewControls({
  displayed,
  disabled,
}: {
  displayed: DisplayedRevision[];
  disabled: boolean;
}) {
  const { runtime, state, isUnseen } = useTrackingReview();
  const [marking, setMarking] = useState(false);
  if (!runtime) return null;
  const changed = displayed.filter((row) => isUnseen(row.shipmentId));
  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: 'flex-start' }}>
        <FormControlLabel
          label="Tracking sound"
          control={
            <Switch
              checked={state.sound}
              onChange={(_event, checked) => {
                if (checked) void runtime.sound.enable();
                else void runtime.store.setSound(false);
              }}
            />
          }
        />
        {state.sound && (
          <Button onClick={() => void runtime.sound.enable()}>Enable sound in this tab</Button>
        )}
        {changed.length > 0 && (
          <Button
            variant="outlined"
            disabled={disabled || marking}
            onClick={async () => {
              setMarking(true);
              try {
                for (const revision of changed) await runtime.controller.acknowledge(revision);
              } finally {
                setMarking(false);
              }
            }}
          >
            Mark displayed changes as seen
          </Button>
        )}
      </Stack>
      {state.warning && <Alert severity="warning">{state.warning}</Alert>}
    </Stack>
  );
}

/** A hidden document, stale/failed response, or unmounted detail cannot review a revision. */
export function useDisplayedRevision(revision: DisplayedRevision | undefined, successful: boolean) {
  const { runtime, state } = useTrackingReview();
  const shipmentId = revision?.shipmentId;
  const snapshotId = revision?.snapshotId;
  const record = shipmentId ? state.records[shipmentId] : undefined;
  useEffect(() => {
    if (!runtime || !successful || !shipmentId || !snapshotId) return;
    if (record?.snapshotId === snapshotId && !hasUnseen(record)) return;
    let mounted = true;
    const visible = () => mounted && document.visibilityState === 'visible';
    const acknowledge = () => {
      if (visible()) void runtime.controller.acknowledge({ shipmentId, snapshotId }, visible);
    };
    acknowledge();
    document.addEventListener('visibilitychange', acknowledge);
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', acknowledge);
    };
  }, [runtime, shipmentId, snapshotId, successful, record]);
}
