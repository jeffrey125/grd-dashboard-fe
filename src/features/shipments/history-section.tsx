import { safeError } from '@api/api';
import { useSession } from '@features/auth';
import { liveQuery } from '@features/tracking-updates';
import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TablePagination from '@mui/material/TablePagination';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { getShipmentHistory } from './api';
import { historyFields, snapshotDifferences } from './history-model';

export function HistorySection({
  id,
  page,
  pageSize,
  onMissing,
}: {
  id: string;
  page: number;
  pageSize: number;
  onMissing: () => void;
}) {
  const { session } = useSession();
  const navigate = useNavigate({ from: '/shipments/$shipmentId' });
  const query = useQuery({
    queryKey: ['history', id, page, pageSize],
    queryFn: ({ signal }) => getShipmentHistory(session.client, id, page, pageSize, signal),
    retry: false,
    ...liveQuery({ target: { kind: 'history', externalId: id }, onMissing }),
  });
  const data = query.data;
  const previous = useRef<string | undefined>(undefined);
  const [updated, setUpdated] = useState(false);
  const changePage = (next: number, size: number) =>
    navigate({
      search: (current) => ({ ...current, page: String(next), pageSize: String(size) }),
      resetScroll: false,
    });
  useEffect(() => {
    if (!data) return;
    const signature = `${data.total}:${data.items.map((item) => item.externalId).join(',')}`;
    if (previous.current !== undefined && previous.current !== signature) setUpdated(true);
    previous.current = signature;
  }, [data]);
  useEffect(() => {
    if (!data || query.isFetching || query.isError) return;
    const lastPage = Math.max(1, Math.ceil(data.total / pageSize));
    if (page > lastPage)
      void navigate({
        search: (current) => ({ ...current, page: String(lastPage) }),
        replace: true,
        resetScroll: false,
      });
  }, [data, page, pageSize, navigate, query.isFetching, query.isError]);

  return (
    <Stack spacing={2}>
      <Typography component="h2" variant="h6">
        Tracking history
      </Typography>
      <Typography color="text.secondary">
        Application-recorded tracking observations, newest first. This is not a complete carrier
        event timeline. Unchanged checks and unsuccessful lookups do not add observations.
      </Typography>
      {updated && (
        <Alert severity="info" role="status" onClose={() => setUpdated(false)}>
          History updated. New observations can shift entries between pages.
        </Alert>
      )}
      {query.isError && (
        <Alert
          severity={data ? 'warning' : 'error'}
          action={<Button onClick={() => void query.refetch()}>Retry</Button>}
        >
          {data ? 'Showing previously loaded history. ' : ''}
          {safeError(query.error).message}
        </Alert>
      )}
      {query.isFetching && (
        <Typography role="status">{data ? 'Updating history…' : 'Loading history…'}</Typography>
      )}
      {data?.total === 0 && <Typography>No tracking observations recorded yet.</Typography>}
      {data && data.total > 0 && !data.items.length && (
        <Typography role="status">
          No observations on this page. Returning to the last available page…
        </Typography>
      )}
      {data?.items.map((snapshot, index) => {
        const initial = (page - 1) * pageSize + index === data.total - 1;
        const older = data.items[index + 1];
        const differences = snapshotDifferences(snapshot, older);
        return (
          <Paper
            component="article"
            key={snapshot.externalId}
            variant="outlined"
            sx={{ p: 2 }}
            aria-label={`${initial ? 'Initial observation' : 'Tracking observation'} ${snapshot.externalId}`}
          >
            <Stack spacing={1.5}>
              <Typography component="h3" variant="subtitle1">
                {initial ? 'Initial observation' : 'Tracking observation'} ·{' '}
                {businessTimestamp(snapshot.observedAt)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Snapshot ID: {snapshot.externalId}
              </Typography>
              <Box
                component="dl"
                sx={{
                  m: 0,
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
                }}
              >
                {(Object.keys(historyFields) as (keyof typeof historyFields)[]).map((field) => (
                  <Box key={field}>
                    <Typography component="dt" variant="caption" color="text.secondary">
                      {historyFields[field]}
                    </Typography>
                    <Typography component="dd" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                      {snapshot[field] ?? 'Not available'}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {differences.length > 0 && (
                <Box component="ul" aria-label="Changed fields" sx={{ m: 0, pl: 2.5 }}>
                  {differences.map((change) => (
                    <Typography component="li" key={change.field} sx={{ whiteSpace: 'pre-wrap' }}>
                      Changed {change.label.toLowerCase()}: {change.before ?? 'Not available'} →{' '}
                      {change.after ?? 'Not available'}
                    </Typography>
                  ))}
                </Box>
              )}
              {!initial && !older && (
                <Typography variant="body2" color="text.secondary">
                  Earlier observation is on another page; field comparison unavailable here.
                </Typography>
              )}
            </Stack>
          </Paper>
        );
      })}
      {data && (
        <TablePagination
          component="div"
          count={data.total}
          page={Math.min(page - 1, Math.max(0, Math.ceil(data.total / pageSize) - 1))}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[25, 50, 100]}
          labelRowsPerPage="Observations per page"
          disabled={query.isFetching}
          onPageChange={(_event, next) => void changePage(next + 1, pageSize)}
          onRowsPerPageChange={(event) => void changePage(1, Number(event.target.value))}
          sx={{
            '& .MuiTablePagination-toolbar': {
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              pl: 0,
            },
            '& .MuiTablePagination-selectLabel': { display: 'block' },
            '& .MuiTablePagination-input': { display: 'inline-flex' },
          }}
        />
      )}
    </Stack>
  );
}
