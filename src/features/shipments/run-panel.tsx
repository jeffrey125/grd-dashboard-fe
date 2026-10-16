import { safeError } from '@api/api';
import { useSession } from '@features/auth';
import { liveQuery } from '@features/tracking-updates';
import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getRun } from './api';
import { activeRun, diagnosticMessage, runPollInterval } from './detail-model';
import type { TrackingRun } from './schemas';

export function RunPanel({
  run,
  shipmentId,
  title,
}: {
  run: TrackingRun;
  shipmentId: string;
  title: string;
}) {
  const { session } = useSession();
  const queries = useQueryClient();
  const query = useQuery({
    queryKey: ['run', run.externalId],
    queryFn: ({ signal }) => getRun(session.client, run.externalId, signal),
    ...liveQuery({ target: { kind: 'run', externalId: run.externalId } }),
    refetchInterval: (value) => runPollInterval(value.state.data ?? run, value.state.error),
    refetchIntervalInBackground: false,
    retry: false,
  });
  const current = query.data ?? run;
  const terminal = !activeRun(current);
  // A missed shipment event must not leave the lookup projection behind a finished run.
  useEffect(() => {
    if (terminal) {
      void queries.invalidateQueries({ queryKey: ['shipment', shipmentId] });
      void queries.invalidateQueries({ queryKey: ['history', shipmentId] });
    }
  }, [terminal, queries, shipmentId]);
  const attempt = query.data?.attempts.find((value) => value.shipmentExternalId === shipmentId);
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}
    >
      <Typography component="h3" variant="subtitle1">
        {title}
      </Typography>
      <Typography>Run: {current.status.replaceAll('_', ' ')}</Typography>
      <Typography variant="body2">
        {current.trigger === 'manual' ? 'Manual' : 'Scheduled'} · {current.attemptCount} attempts
        across this run
      </Typography>
      <Typography variant="body2">Requested: {businessTimestamp(current.createdAt)}</Typography>
      <Typography variant="body2">Started: {businessTimestamp(current.startedAt)}</Typography>
      <Typography variant="body2">Completed: {businessTimestamp(current.completedAt)}</Typography>
      {current.status === 'queued' && (
        <Typography variant="body2">
          Waiting for processing; the carrier has not necessarily been queried.
        </Typography>
      )}
      {attempt && (
        <Typography variant="body2">
          This shipment’s attempt: {attempt.outcome.replaceAll('_', ' ')}
        </Typography>
      )}
      {diagnosticMessage(attempt?.reasonCode ?? query.data?.reasonCode ?? null) && (
        <Typography variant="body2">
          {diagnosticMessage(attempt?.reasonCode ?? query.data?.reasonCode ?? null)}
        </Typography>
      )}
      {query.isError && (
        <Alert
          severity="warning"
          action={<Button onClick={() => void query.refetch()}>Retry</Button>}
        >
          Run progress could not be updated. {safeError(query.error).message}
        </Alert>
      )}
    </Box>
  );
}
