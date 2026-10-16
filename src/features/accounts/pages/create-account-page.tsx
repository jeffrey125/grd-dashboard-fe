import { useNotifications } from '@components/feedback/notification-provider';
import { PageHeader } from '@components/layout/page-header';
import { AccountConflict, createAccount } from '@features/accounts/api';
import { type CreateAccountInput, createAccountSchema } from '@features/accounts/schemas';
import { UnsavedAccountChanges } from '@features/accounts/unsaved-changes';
import { useAccountWrite } from '@features/accounts/use-account-write';
import { useSession } from '@features/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';

export function CreateAccountPage() {
  const { session } = useSession();
  const queries = useQueryClient();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const write = useAccountWrite();
  const bypass = useRef(false);
  const form = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: 'staff',
      password: '',
      confirmPassword: '',
    },
  });
  const { errors, isDirty, isSubmitting } = form.formState;
  const pending = write.pending || isSubmitting;
  const submit = form.handleSubmit((input) =>
    write.run(async () => {
      try {
        const created = await createAccount(session.client, input);
        form.reset();
        bypass.current = true;
        void queries.invalidateQueries({ queryKey: ['accounts'] });
        showNotification({
          message:
            'Account created. Deliver the issued password separately; replacement is required at next sign-in.',
          severity: 'success',
        });
        await navigate({
          to: '/admin/accounts/$accountId',
          params: { accountId: created.externalId },
        });
      } catch (error) {
        if (error instanceof AccountConflict && error.field === 'email')
          form.setError('email', { message: error.message }, { shouldFocus: true });
        throw error;
      }
    }),
  );
  return (
    <>
      <PageHeader
        title="Create account"
        breadcrumbs={[{ label: 'Accounts', href: '/admin/accounts' }, { label: 'Create account' }]}
      />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 720 }}>
        <Stack
          component="form"
          aria-label="Create account"
          noValidate
          spacing={2}
          onSubmit={submit}
        >
          <Alert severity="info">
            The account starts active. Deliver the issued password through your agreed private
            channel. No email is sent. The employee must replace it at their next sign-in.
          </Alert>
          {write.error && <Alert severity="error">{write.error}</Alert>}
          {(['firstName', 'lastName', 'email'] as const).map((field) => (
            <TextField
              key={field}
              label={{ firstName: 'First name', lastName: 'Last name', email: 'Email' }[field]}
              type={field === 'email' ? 'email' : 'text'}
              autoComplete="off"
              fullWidth
              disabled={pending}
              {...form.register(field)}
              error={!!errors[field]}
              helperText={errors[field]?.message}
            />
          ))}
          <TextField
            label="Role"
            select
            fullWidth
            disabled={pending}
            {...form.register('role')}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </TextField>
          {(['password', 'confirmPassword'] as const).map((field) => (
            <TextField
              key={field}
              label={field === 'password' ? 'Issued password' : 'Confirm issued password'}
              type="password"
              autoComplete="new-password"
              fullWidth
              disabled={pending}
              {...form.register(field)}
              error={!!errors[field]}
              helperText={
                errors[field]?.message ??
                (field === 'password' ? '12–128 characters. Spaces are preserved.' : undefined)
              }
            />
          ))}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button component={Link} to="/admin/accounts" disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={pending || write.remaining > 0}>
              {write.remaining > 0
                ? `Try again in ${write.remaining}s`
                : pending
                  ? 'Creating…'
                  : 'Create account'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <UnsavedAccountChanges dirty={isDirty} pending={pending} bypass={bypass} />
    </>
  );
}
