import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useBlocker } from '@tanstack/react-router';
import type { RefObject } from 'react';

export function UnsavedAccountChanges({
  dirty,
  pending,
  bypass,
}: {
  dirty: boolean;
  pending: boolean;
  bypass?: RefObject<boolean>;
}) {
  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !bypass?.current,
    enableBeforeUnload: () => dirty && !bypass?.current,
    withResolver: true,
  });
  return (
    <Dialog
      open={blocker.status === 'blocked'}
      onClose={() => blocker.reset?.()}
      aria-labelledby="discard-account-title"
    >
      <DialogTitle id="discard-account-title">Discard unsaved account changes?</DialogTitle>
      <DialogContent>Your changes have not been saved.</DialogContent>
      <DialogActions>
        <Button autoFocus onClick={() => blocker.reset?.()}>
          Keep editing
        </Button>
        <Button color="error" disabled={pending} onClick={() => blocker.proceed?.()}>
          Discard changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
