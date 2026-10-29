import { ApiError, safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import { PageHeader } from '@components/layout/page-header';
import { useSession } from '@features/auth';
import { businessTimestamp } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteSalesRep, listSalesReps, restoreSalesRep } from '../api';
import { SalesRepEditor } from '../sales-rep-editor';
import type { AdminSalesRep } from '../types';

export function SalesRepsPage() {
  const { session, account, status } = useSession();
  const queries = useQueryClient();
  const { showNotification } = useNotifications();
  const mobile = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [editor, setEditor] = useState<AdminSalesRep | 'new' | null>(null);
  const [removing, setRemoving] = useState<AdminSalesRep | null>(null);
  const query = useQuery({
    queryKey: ['admin-sales-reps'],
    queryFn: ({ signal }) => listSalesReps(session.client, signal),
    enabled: status === 'authenticated' && account?.role === 'admin',
    retry: false,
    staleTime: 0,
  });
  const remove = useMutation({
    mutationFn: (rep: AdminSalesRep) => deleteSalesRep(session.client, rep.externalId),
    retry: false,
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: ['admin-sales-reps'] });
      await queries.invalidateQueries({ queryKey: ['sales-reps'] });
      showNotification({ message: 'Sales Rep deactivated.', severity: 'success' });
      setRemoving(null);
    },
  });
  const restore = useMutation({
    mutationFn: (rep: AdminSalesRep) => restoreSalesRep(session.client, rep.externalId),
    retry: false,
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: ['admin-sales-reps'] });
      await queries.invalidateQueries({ queryKey: ['sales-reps'] });
      showNotification({ message: 'Sales Rep restored.', severity: 'success' });
    },
    onError: (error) => {
      showNotification({ message: safeError(error).message, severity: 'error' });
    },
  });
  const inaccessible = query.error instanceof ApiError && [401, 403].includes(query.error.status);
  const data = inaccessible ? undefined : query.data;
  const refresh = () => void query.refetch();
  return (
    <Stack spacing={2} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <PageHeader
        title="Sales Reps"
        description="Configure the Sales Reps available for shipment assignment. Only Admins can access this page."
        actions={
          <Button variant="contained" onClick={() => setEditor('new')}>
            Add Sales Rep
          </Button>
        }
      />
      {query.isPending && <Typography role="status">Loading Sales Reps…</Typography>}
      {query.error && (
        <Alert
          severity={data ? 'warning' : 'error'}
          action={
            <Button disabled={query.isFetching} onClick={refresh}>
              Retry
            </Button>
          }
        >
          {data ? 'Sales Rep refresh failed. Showing the last loaded list. ' : ''}
          {safeError(query.error).message}
        </Alert>
      )}
      {data && data.length === 0 && <Typography>No Sales Reps configured.</Typography>}
      {data &&
        (mobile ? (
          <Stack spacing={2} aria-label="Sales Rep cards">
            {data.map((rep) => (
              <Card key={rep.externalId} variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography component="h2" variant="h6">
                      {rep.firstName} {rep.lastName}
                    </Typography>
                    <Typography variant="body2">{rep.email}</Typography>
                    <Chip
                      size="small"
                      sx={{ alignSelf: 'flex-start' }}
                      label={rep.active ? 'Active' : 'Inactive'}
                      color={rep.active ? 'success' : 'default'}
                      variant="outlined"
                    />
                    <Typography variant="body2" color="text.secondary">
                      Updated {businessTimestamp(rep.updatedAt)}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      {rep.active ? (
                        <>
                          <Button size="small" onClick={() => setEditor(rep)}>
                            Edit
                          </Button>
                          <Button size="small" color="error" onClick={() => setRemoving(rep)}>
                            Deactivate
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="small"
                          onClick={() => restore.mutate(rep)}
                          disabled={restore.isPending}
                        >
                          Restore
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          <Table aria-label="Sales Rep configuration">
            <TableHead>
              <TableRow>
                {['First name', 'Last name', 'Email', 'Status', 'Updated', 'Actions'].map(
                  (label) => (
                    <TableCell key={label}>{label}</TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((rep) => (
                <TableRow key={rep.externalId}>
                  <TableCell>{rep.firstName}</TableCell>
                  <TableCell>{rep.lastName}</TableCell>
                  <TableCell>{rep.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={rep.active ? 'Active' : 'Inactive'}
                      color={rep.active ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{businessTimestamp(rep.updatedAt)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {rep.active ? (
                        <>
                          <Button size="small" onClick={() => setEditor(rep)}>
                            Edit
                          </Button>
                          <Button size="small" color="error" onClick={() => setRemoving(rep)}>
                            Deactivate
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="small"
                          onClick={() => restore.mutate(rep)}
                          disabled={restore.isPending}
                        >
                          Restore
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
      <Dialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="sales-rep-editor-title"
      >
        <DialogTitle id="sales-rep-editor-title">
          {editor === 'new' ? 'Add Sales Rep' : 'Edit Sales Rep'}
        </DialogTitle>
        <DialogContent>
          <SalesRepEditor
            client={session.client}
            rep={editor && editor !== 'new' ? editor : undefined}
            onCancel={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              await queries.invalidateQueries({ queryKey: ['admin-sales-reps'] });
              await queries.invalidateQueries({ queryKey: ['sales-reps'] });
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!removing}
        onClose={() => {
          if (!remove.isPending) setRemoving(null);
        }}
        aria-labelledby="deactivate-sales-rep-title"
      >
        <DialogTitle id="deactivate-sales-rep-title">Deactivate Sales Rep?</DialogTitle>
        <DialogContent>
          <Typography>
            {removing?.firstName} {removing?.lastName}
          </Typography>
          <Typography sx={{ mt: 1 }}>
            Existing shipments keep this assignment, but new assignments will no longer offer this
            Sales Rep.
          </Typography>
          {remove.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {safeError(remove.error).message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => removing && remove.mutate(removing)}
            disabled={!removing || remove.isPending}
          >
            {remove.isPending ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
