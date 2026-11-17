import { safeError } from '@api/api';
import { useSession } from '@features/auth';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getUpcomingAssignments, saveUpcomingAssignments } from './api';

export function UpcomingAssignments({ accountId }: { accountId: string }) {
  const { session } = useSession();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['upcoming-assignments', accountId],
    queryFn: ({ signal }) => getUpcomingAssignments(session.client, accountId, signal),
    retry: false,
  });
  const [draft, setDraft] = useState<{ ownRepId: string | null; assignedRepIds: string[] } | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: (data: NonNullable<typeof draft>) =>
      saveUpcomingAssignments(session.client, accountId, data),
    onSuccess: async () => {
      setDraft(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['upcoming-assignments', accountId] }),
        client.invalidateQueries({ queryKey: ['upcoming-access'] }),
        client.invalidateQueries({ queryKey: ['upcoming-shipments'] }),
      ]);
    },
  });
  const data = query.data;
  const value = draft ?? data;
  const label = (id: string) =>
    data?.reps.find((rep) => rep.id === id)?.name ?? `Unavailable rep (${id})`;
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          Upcoming shipment access
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Link this account to its own Airtable rep, or assign multiple reps for a sales assistant.
          Leaving both empty hides Upcoming Shipments for Staff. Admins can always view all reps.
        </Typography>
        {query.isPending && (
          <Typography role="status">Loading Airtable representatives…</Typography>
        )}
        {query.isError && (
          <Alert
            severity="error"
            action={<Button onClick={() => void query.refetch()}>Retry</Button>}
          >
            Representatives could not be loaded.
          </Alert>
        )}
        {data && !data.configured && (
          <Alert severity="info">Airtable access has not been configured on the server.</Alert>
        )}
        {data?.directoryUnavailable && (
          <Alert severity="warning">
            Airtable representatives could not be loaded. You can still remove existing access;
            retry to add representatives.
          </Alert>
        )}
        {data && value && (
          <>
            <Autocomplete
              options={data.reps.map((rep) => rep.id)}
              getOptionLabel={label}
              value={value.ownRepId}
              disabled={mutation.isPending}
              onChange={(_, ownRepId) => setDraft({ ...value, ownRepId })}
              renderInput={(params) => <TextField {...params} label="Own sales rep" />}
            />
            {data.suggestedRepIds.length === 1 && !value.ownRepId && (
              <Alert
                severity="info"
                action={
                  <Button
                    onClick={() =>
                      setDraft({ ...value, ownRepId: data.suggestedRepIds[0] ?? null })
                    }
                  >
                    Use suggestion
                  </Button>
                }
              >
                Email matches {label(data.suggestedRepIds[0] ?? '')}. Confirm by saving.
              </Alert>
            )}
            <Autocomplete
              multiple
              options={data.reps.map((rep) => rep.id)}
              getOptionLabel={label}
              value={value.assignedRepIds}
              disabled={mutation.isPending}
              onChange={(_, assignedRepIds) => setDraft({ ...value, assignedRepIds })}
              renderInput={(params) => <TextField {...params} label="Assistant’s assigned reps" />}
            />
            {mutation.isError && (
              <Alert severity="error">{safeError(mutation.error).message}</Alert>
            )}
            {mutation.isSuccess && !draft && (
              <Alert severity="success">Shipment access saved.</Alert>
            )}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={!draft || mutation.isPending || query.isError}
                onClick={() => draft && mutation.mutate(draft)}
              >
                Save shipment access
              </Button>
              {draft && (
                <Button
                  disabled={mutation.isPending}
                  onClick={() => {
                    setDraft(null);
                    mutation.reset();
                  }}
                >
                  Cancel
                </Button>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}
