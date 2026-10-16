import Alert from '@mui/material/Alert';
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { LiveUpdates } from './live-updates';

export const LiveUpdatesContext = createContext<LiveUpdates | null>(null);

export function LiveStatus() {
  const live = useContext(LiveUpdatesContext);
  return live ? <Status live={live} /> : null;
}

function Status({ live }: { live: LiveUpdates }) {
  const { warning, connection } = useSyncExternalStore(live.subscribe, live.getSnapshot);
  if (!warning) return null;
  return (
    <Alert severity="warning" role="status" sx={{ mb: 3 }}>
      {connection === 'disconnected'
        ? 'Live updates disconnected—data may be stale.'
        : 'Synchronizing live updates—data may be stale.'}
    </Alert>
  );
}
