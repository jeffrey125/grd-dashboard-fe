import { SessionCancelled, safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import { useSession } from '@features/auth/context';
import {
  changePasswordSchema,
  type PasswordInput,
  type SignInInput,
  signInSchema,
} from '@features/auth/schemas';
import { useCooldown } from '@features/auth/use-cooldown';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthLayout } from './auth-layout';

function useFormFailure() {
  const [error, setError] = useState<string>();
  const [retryAt, setRetryAt] = useState(0);
  const remaining = useCooldown(retryAt);
  const { showNotification } = useNotifications();
  return {
    error,
    remaining,
    clear: () => setError(undefined),
    fail: (error: unknown, login = false) => {
      if (error instanceof SessionCancelled) return;
      const normalized = safeError(error);
      const message =
        login && normalized.status === 401 ? 'Email or password is incorrect.' : normalized.message;
      setError(message);
      setRetryAt(normalized.retryAt);
      showNotification({ message, severity: 'error' });
    },
  };
}

export function LoginPage() {
  const { session, notice } = useSession();
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const failure = useFormFailure();
  const submit = form.handleSubmit(async (input) => {
    failure.clear();
    try {
      await session.signIn(input);
    } catch (error) {
      failure.fail(error, true);
    } finally {
      form.resetField('password');
    }
  });
  return (
    <AuthLayout title="Sign in">
      <Typography color="text.secondary">
        Use your employee account. Contact your administrator if you need access or a password
        reset.
      </Typography>
      {notice && <Alert severity="info">{notice}</Alert>}
      {failure.error && <Alert severity="error">{failure.error}</Alert>}
      <Stack component="form" noValidate spacing={2} onSubmit={submit}>
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          {...form.register('email')}
          error={Boolean(form.formState.errors.email)}
          helperText={form.formState.errors.email?.message}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
          error={Boolean(form.formState.errors.password)}
          helperText={form.formState.errors.password?.message}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={form.formState.isSubmitting || failure.remaining > 0}
        >
          {failure.remaining > 0
            ? `Try again in ${failure.remaining}s`
            : form.formState.isSubmitting
              ? 'Signing in…'
              : 'Sign in'}
        </Button>
      </Stack>
    </AuthLayout>
  );
}

export function ChangePasswordPage() {
  const { session, status } = useSession();
  const form = useForm<PasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const failure = useFormFailure();
  const submit = form.handleSubmit(async (input) => {
    failure.clear();
    try {
      await session.changePassword(input);
    } catch (error) {
      failure.fail(error);
    } finally {
      form.reset();
    }
  });
  return (
    <AuthLayout title="Change password">
      <Alert severity="info">
        {status === 'restricted'
          ? 'Replace your issued password before accessing the dashboard. '
          : ''}
        Changing your password signs you out of all sessions.
      </Alert>
      {failure.error && <Alert severity="error">{failure.error}</Alert>}
      <Stack component="form" noValidate spacing={2} onSubmit={submit}>
        {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((name) => (
          <TextField
            key={name}
            label={
              {
                currentPassword: 'Current password',
                newPassword: 'New password',
                confirmPassword: 'Confirm new password',
              }[name]
            }
            type="password"
            autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
            {...form.register(name)}
            error={Boolean(form.formState.errors[name])}
            helperText={
              form.formState.errors[name]?.message ??
              (name === 'newPassword' ? '12–128 characters. Spaces are preserved.' : undefined)
            }
          />
        ))}
        <Button
          type="submit"
          variant="contained"
          disabled={form.formState.isSubmitting || failure.remaining > 0}
        >
          {failure.remaining > 0
            ? `Try again in ${failure.remaining}s`
            : form.formState.isSubmitting
              ? 'Changing password…'
              : 'Change password'}
        </Button>
        <Button disabled={form.formState.isSubmitting} onClick={() => void session.signOut()}>
          Sign out
        </Button>
        {status === 'authenticated' && (
          <Button component={Link} to="/">
            Return to dashboard
          </Button>
        )}
      </Stack>
    </AuthLayout>
  );
}
