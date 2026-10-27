import { SessionCancelled, safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import { useSession } from '@features/auth';
import { businessCalendarDate, parseCalendarDate } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { updateShipment } from './api';
import type { Shipment } from './schemas';

export function MonitorAgainDialog({
  shipment,
  onClose,
}: {
  shipment: Shipment;
  onClose: () => void;
}) {
  const { session } = useSession();
  const queries = useQueryClient();
  const { showNotification } = useNotifications();
  const tomorrow = parseCalendarDate(businessCalendarDate()).add(1, 'day').format('YYYY-MM-DD');
  const [followUpOn, setFollowUpOn] = useState(
    shipment.followUpOn && shipment.followUpOn > businessCalendarDate()
      ? shipment.followUpOn
      : tomorrow,
  );
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationKey: ['shipment-assignment', shipment.externalId],
    mutationFn: () => updateShipment(session.client, shipment.externalId, { followUpOn }),
    retry: false,
    onSettled: () => {
      void queries.invalidateQueries({ queryKey: ['shipments'] });
      void queries.invalidateQueries({ queryKey: ['shipment', shipment.externalId] });
      void queries.invalidateQueries({ queryKey: ['overview'] });
    },
  });
  const submit = async () => {
    if (submitting.current) return;
    if (!z.iso.date().safeParse(followUpOn).success || followUpOn <= businessCalendarDate()) {
      setError('Choose a follow-up date after today in New York.');
      return;
    }
    submitting.current = true;
    setError(null);
    try {
      const updated = await mutation.mutateAsync();
      showNotification({
        message:
          updated.monitoringStatus === 'active'
            ? `${shipment.trackingReference}: monitoring resumed until ${followUpOn} (New York time).`
            : updated.monitoringStatus === 'paused'
              ? 'Follow-up saved. Monitoring remains paused; use the available resume or retry action.'
              : 'Follow-up saved. Monitoring has completed; choose a date after today to restart.',
        severity: 'success',
      });
      onClose();
    } catch (failure) {
      if (!(failure instanceof SessionCancelled)) setError(safeError(failure).message);
    } finally {
      submitting.current = false;
    }
  };
  return (
    <Dialog
      open
      onClose={() => !mutation.isPending && onClose()}
      fullWidth
      maxWidth="xs"
      aria-labelledby="monitor-again-title"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <DialogTitle id="monitor-again-title">Monitor again</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              Continue checking {shipment.trackingReference} until the start of the follow-up date
              in New York time. Its carrier status stays Delivered.
            </Typography>
            {!shipment.carrier.isActive && (
              <Alert severity="warning">
                The carrier is disabled. Checks can run after an administrator enables it.
              </Alert>
            )}
            <TextField
              type="date"
              label="Follow-up date"
              value={followUpOn}
              onChange={(event) => setFollowUpOn(event.target.value)}
              required
              disabled={mutation.isPending}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: tomorrow } }}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Start monitoring'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
