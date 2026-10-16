import { useNotifications } from '@components/feedback/notification-provider';
import { type Account, useSession } from '@features/auth';
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
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { resetAccountPassword, updateAccount } from './api';
import { type IssuedPasswordInput, issuedPasswordSchema } from './schemas';
import { UnsavedAccountChanges } from './unsaved-changes';
import { useAccountWrite } from './use-account-write';

export function AccessActions({ account, disabled }: { account: Account; disabled: boolean }) {
  const { session, account: actor } = useSession();
  const queries = useQueryClient();
  const { showNotification } = useNotifications();
  const [activation, setActivation] = useState<boolean>();
  const [resetOpen, setResetOpen] = useState(false);
  const write = useAccountWrite();
  const own = actor?.externalId === account.externalId;
  const form = useForm<IssuedPasswordInput>({
    resolver: zodResolver(issuedPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const close = () => {
    if (!write.pending) {
      setActivation(undefined);
      setResetOpen(false);
      form.reset();
      write.clear();
    }
  };
  const changeActive = () =>
    write.run(async () => {
      if (activation === undefined || own) return;
      await updateAccount(session.client, account.externalId, { active: activation });
      setActivation(undefined);
      showNotification({
        message: activation
          ? 'Account activated.'
          : 'Account deactivated. Its sessions have been signed out.',
        severity: 'success',
      });
      await queries.invalidateQueries({ queryKey: ['accounts'] });
    });
  const reset = form.handleSubmit((input) =>
    write.run(async () => {
      await resetAccountPassword(session.client, account.externalId, input);
      form.reset();
      setResetOpen(false);
      showNotification({
        message:
          'Password reset. Deliver the issued password separately; replacement is required at next sign-in.',
        severity: 'success',
      });
      await queries.invalidateQueries({ queryKey: ['accounts'] });
    }),
  );
  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ p: 2 }}
      aria-labelledby="account-access-title"
    >
      <Stack spacing={2}>
        <Typography component="h2" variant="h6" id="account-access-title">
          Account access
        </Typography>
        {disabled && (
          <Typography>Save or cancel profile edits before changing account access.</Typography>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="outlined"
            color={account.active ? 'error' : 'primary'}
            disabled={disabled || own || write.pending}
            onClick={() => {
              write.clear();
              setActivation(!account.active);
            }}
          >
            {account.active ? 'Deactivate account' : 'Activate account'}
          </Button>
          {own ? (
            <Button component={Link} to="/change-password" disabled={disabled}>
              Change my password
            </Button>
          ) : (
            <Button
              variant="outlined"
              disabled={disabled || write.pending}
              onClick={() => {
                write.clear();
                form.reset();
                setResetOpen(true);
              }}
            >
              Reset password
            </Button>
          )}
        </Stack>
        {own && (
          <Typography variant="body2" color="text.secondary">
            You cannot deactivate your own Admin account. Changing your password signs you out of
            all sessions.
          </Typography>
        )}
      </Stack>
      <Dialog open={activation !== undefined} onClose={close} aria-labelledby="activation-title">
        <DialogTitle id="activation-title">
          {activation ? 'Activate account?' : 'Deactivate account?'}
        </DialogTitle>
        <DialogContent>
          {account.firstName} {account.lastName} ({account.email})
          <Typography sx={{ mt: 1 }}>
            {activation
              ? 'This account will be allowed to sign in again. Any required password replacement still applies.'
              : 'This account will lose access immediately and all its sessions will be signed out. Its records will remain.'}
          </Typography>
          {write.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {write.error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button autoFocus disabled={write.pending} onClick={close}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={activation ? 'primary' : 'error'}
            disabled={write.pending || write.remaining > 0}
            onClick={() => void changeActive()}
          >
            {write.pending ? 'Saving…' : activation ? 'Confirm activation' : 'Confirm deactivation'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={resetOpen}
        onClose={close}
        fullWidth
        maxWidth="sm"
        aria-labelledby="reset-password-title"
      >
        <DialogTitle id="reset-password-title">Reset password</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            id="reset-account-password"
            aria-label="Reset account password"
            noValidate
            spacing={2}
            onSubmit={reset}
            sx={{ pt: 1 }}
          >
            <Typography>
              Reset the password for {account.firstName} {account.lastName} ({account.email})?
            </Typography>
            <Alert severity="warning">
              All their sessions will be signed out. Deliver this password privately; no email is
              sent. They must replace it at next sign-in. Resetting a password does not activate an
              inactive account.
            </Alert>
            {write.error && <Alert severity="error">{write.error}</Alert>}
            {(['password', 'confirmPassword'] as const).map((field) => (
              <TextField
                key={field}
                label={field === 'password' ? 'Issued password' : 'Confirm issued password'}
                type="password"
                autoComplete="new-password"
                fullWidth
                disabled={write.pending}
                {...form.register(field)}
                error={!!form.formState.errors[field]}
                helperText={
                  form.formState.errors[field]?.message ??
                  (field === 'password' ? '12–128 characters. Spaces are preserved.' : undefined)
                }
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={write.pending} onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="reset-account-password"
            variant="contained"
            disabled={write.pending || write.remaining > 0}
          >
            {write.remaining > 0
              ? `Try again in ${write.remaining}s`
              : write.pending
                ? 'Resetting…'
                : 'Confirm password reset'}
          </Button>
        </DialogActions>
      </Dialog>
      <UnsavedAccountChanges dirty={resetOpen && form.formState.isDirty} pending={write.pending} />
    </Paper>
  );
}
