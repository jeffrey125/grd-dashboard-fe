import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useShipmentCommand } from './actions';
import type { Shipment, TrackingRun } from './schemas';

export function MonitorAgainDialog({
  shipment,
  onClose,
  onRefresh,
}: {
  shipment: Shipment;
  onClose: () => void;
  onRefresh?: (run: TrackingRun) => void;
}) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const command = useShipmentCommand(shipment.externalId, {
    onRefresh: (run) => {
      onRefresh?.(run);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={() => !command.pending && onClose()}
      fullWidth
      maxWidth="xs"
      transitionDuration={reducedMotion ? 0 : 320}
      aria-labelledby="monitor-again-title"
      aria-describedby="monitor-again-description"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          command.execute(shipment, 'refresh');
        }}
      >
        <DialogTitle id="monitor-again-title">Monitor again</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography id="monitor-again-description">
              Check {shipment.trackingReference} once for the latest carrier update. Confirmed
              deliveries stay in Delivered. This does not change the follow-up date or restart
              automatic checks.
            </Typography>
            <Typography variant="body2">
              If the carrier explicitly corrects delivery back to an in-transit status, normal
              monitoring resumes.
            </Typography>
            {!shipment.carrier.isActive && (
              <Alert severity="warning">
                The carrier is disabled. An administrator must enable it before checking again.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={command.pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={command.pending || !shipment.carrier.isActive}
          >
            {command.pending ? 'Requesting…' : 'Check once'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
