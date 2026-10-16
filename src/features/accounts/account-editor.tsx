import { useNotifications } from '@components/feedback/notification-provider';
import { type Account, useSession } from '@features/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { updateAccount } from './api';
import { type ProfileInput, profilePatch, profileSchema } from './schemas';
import { UnsavedAccountChanges } from './unsaved-changes';
import { useAccountWrite } from './use-account-write';

export function AccountEditor({ account, onClose }: { account: Account; onClose: () => void }) {
  const { session, account: actor } = useSession();
  const queries = useQueryClient();
  const { showNotification } = useNotifications();
  const [baseline] = useState<ProfileInput>({
    firstName: account.firstName,
    lastName: account.lastName,
    role: account.role,
  });
  const [confirmation, setConfirmation] = useState<ProfileInput>();
  const write = useAccountWrite();
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: baseline,
  });
  const own = actor?.externalId === account.externalId;
  const { errors } = form.formState;
  const dirty = form.formState.isDirty;
  const save = (input: ProfileInput) =>
    write.run(async () => {
      const generation = session.getSnapshot().generation;
      const patch = profilePatch(baseline, input);
      if (!Object.keys(patch).length) {
        onClose();
        return;
      }
      if (own && patch.role === 'staff') return;
      await updateAccount(session.client, account.externalId, patch);
      form.reset(input);
      await queries.invalidateQueries({ queryKey: ['accounts'] });
      if (session.getSnapshot().generation !== generation) return;
      if (own) await session.accountChanged();
      if (session.getSnapshot().generation !== generation) return;
      showNotification({ message: 'Account changes saved.', severity: 'success' });
      onClose();
    });
  const submit = form.handleSubmit(async (input) => {
    if (input.role !== baseline.role) setConfirmation(input);
    else await save(input);
  });
  return (
    <>
      <Stack component="form" aria-label="Edit account" noValidate spacing={2} onSubmit={submit}>
        {write.error && <Alert severity="error">{write.error}</Alert>}
        {(['firstName', 'lastName'] as const).map((field) => (
          <TextField
            key={field}
            label={field === 'firstName' ? 'First name' : 'Last name'}
            disabled={write.pending || !!confirmation}
            {...form.register(field)}
            error={!!errors[field]}
            helperText={errors[field]?.message}
            fullWidth
          />
        ))}
        <TextField
          label="Email"
          value={account.email}
          disabled
          helperText="Email cannot be changed after creation."
          fullWidth
        />
        <TextField
          label="Role"
          select
          {...form.register('role')}
          disabled={own || write.pending || !!confirmation}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          helperText={
            own
              ? 'You cannot demote your own Admin account.'
              : 'Changing role signs this account out of all sessions.'
          }
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </TextField>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={write.pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!dirty || write.pending || write.remaining > 0}
          >
            {write.remaining > 0
              ? `Try again in ${write.remaining}s`
              : write.pending
                ? 'Saving…'
                : 'Save changes'}
          </Button>
        </Stack>
      </Stack>
      <Dialog
        open={!!confirmation}
        onClose={() => {
          if (!write.pending) setConfirmation(undefined);
        }}
        aria-labelledby="role-change-title"
      >
        <DialogTitle id="role-change-title">Confirm role change</DialogTitle>
        <DialogContent>
          Change {account.firstName} {account.lastName} ({account.email}) to{' '}
          {confirmation?.role === 'admin' ? 'Admin' : 'Staff'}?
          {confirmation?.role === 'admin'
            ? ' They will be able to manage accounts and carrier settings.'
            : ' They will lose access to account and carrier administration.'}
          {' All their sessions will be signed out. Any name edits will also be saved.'}
          {write.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {write.error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button autoFocus disabled={write.pending} onClick={() => setConfirmation(undefined)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={write.pending || write.remaining > 0}
            onClick={() => {
              if (confirmation) void save(confirmation);
            }}
          >
            {write.pending ? 'Saving…' : 'Confirm role change'}
          </Button>
        </DialogActions>
      </Dialog>
      <UnsavedAccountChanges dirty={dirty} pending={write.pending} />
    </>
  );
}
