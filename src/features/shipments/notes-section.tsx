import { SessionCancelled, safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import { useSession } from '@features/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { saveShipmentNotes } from './api';
import { normalizedNote, noteConflict, notesSchema } from './detail-model';
import type { Shipment } from './schemas';

export function NotesSection({
  shipment,
  disabled,
  bypassNavigation,
  onMissing,
  onDirty,
}: {
  shipment: Shipment;
  disabled: boolean;
  bypassNavigation: RefObject<boolean>;
  onMissing: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const { session } = useSession();
  const queries = useQueryClient();
  const { showNotification } = useNotifications();
  const [editing, setEditing] = useState(false);
  const [baseline, setBaseline] = useState(shipment.notes);
  const submitting = useRef(false);
  const form = useForm<z.input<typeof notesSchema>, unknown, z.output<typeof notesSchema>>({
    resolver: zodResolver(notesSchema),
    defaultValues: { notes: shipment.notes ?? '' },
  });
  const draft = form.watch('notes');
  const dirty = editing && normalizedNote(draft) !== baseline;
  const conflict = editing && noteConflict(baseline, draft, shipment.notes);
  const mutation = useMutation({
    mutationKey: ['shipment-notes', shipment.externalId],
    mutationFn: (notes: string | null) =>
      saveShipmentNotes(session.client, shipment.externalId, notes),
    retry: false,
    // Keep the form and other actions locked until reconciliation completes.
    onSuccess: () =>
      Promise.all([
        queries.invalidateQueries({ queryKey: ['shipment', shipment.externalId] }),
        queries.invalidateQueries({ queryKey: ['shipments'] }),
        queries.invalidateQueries({ queryKey: ['overview'] }),
      ]),
  });
  const pending = mutation.isPending || form.formState.isSubmitting;
  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !bypassNavigation.current,
    enableBeforeUnload: () => dirty && !bypassNavigation.current,
    withResolver: true,
  });
  const { reset } = form;
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  useEffect(() => {
    if (!dirty && !pending) {
      reset({ notes: shipment.notes ?? '' });
      setBaseline(shipment.notes);
    }
  }, [shipment.notes, dirty, pending, reset]);

  const adoptLatest = () => {
    reset({ notes: shipment.notes ?? '' });
    setBaseline(shipment.notes);
    mutation.reset();
  };
  const save = form.handleSubmit(async ({ notes }) => {
    if (submitting.current || disabled) return;
    submitting.current = true;
    try {
      await mutation.mutateAsync(notes);
      // Never install a whole mutation response over a newer live shipment projection.
      setEditing(false);
      showNotification({ message: 'Notes saved.', severity: 'success' });
    } catch (error) {
      if (error instanceof SessionCancelled) return;
      if (safeError(error).status === 404) onMissing();
      showNotification({ message: safeError(error).message, severity: 'error' });
    } finally {
      submitting.current = false;
    }
  });

  return (
    <Paper component="section" aria-labelledby="notes-title" variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography id="notes-title" component="h2" variant="h6">
            Notes
          </Typography>
          {!editing && (
            <Button
              disabled={disabled}
              onClick={() => {
                adoptLatest();
                setEditing(true);
              }}
            >
              Edit notes
            </Button>
          )}
        </Stack>
        {editing ? (
          <Stack component="form" aria-label="Edit shipment notes" spacing={2} onSubmit={save}>
            {conflict && (
              <Alert severity="warning">
                <Typography sx={{ fontWeight: 700 }}>Notes changed elsewhere</Typography>
                <Typography>Latest saved note:</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {shipment.notes ?? 'No notes'}
                </Typography>
                <Typography>
                  Your draft is preserved below. Saving it will replace the saved note.
                </Typography>
                <Button disabled={pending || disabled} onClick={adoptLatest}>
                  Use latest note
                </Button>
              </Alert>
            )}
            <TextField
              {...form.register('notes')}
              label="Notes"
              multiline
              minRows={3}
              fullWidth
              disabled={pending || disabled}
              error={!!form.formState.errors.notes}
              helperText={
                form.formState.errors.notes?.message ?? `${draft.length} / 500 characters`
              }
            />
            {mutation.isError && !(mutation.error instanceof SessionCancelled) && (
              <Alert severity="error">{safeError(mutation.error).message}</Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button
                disabled={pending || disabled}
                onClick={() => {
                  adoptLatest();
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={!dirty || pending || disabled}>
                {pending ? 'Saving…' : conflict ? 'Save my draft anyway' : 'Save notes'}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {shipment.notes ?? 'No notes'}
          </Typography>
        )}
      </Stack>
      <Dialog
        open={blocker.status === 'blocked'}
        onClose={() => blocker.reset?.()}
        aria-labelledby="discard-notes-title"
      >
        <DialogTitle id="discard-notes-title">Discard unsaved note changes?</DialogTitle>
        <DialogContent>Your note changes have not been saved.</DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => blocker.reset?.()}>
            Keep editing
          </Button>
          <Button color="error" disabled={pending} onClick={() => blocker.proceed?.()}>
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
