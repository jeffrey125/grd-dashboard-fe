import { SessionCancelled, safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useForm } from 'react-hook-form';
import { createSalesRep, updateSalesRep } from './api';
import { type SalesRepInput, salesRepInputSchema } from './schemas';
import type { AdminSalesRep } from './types';

export function SalesRepEditor({
  client,
  rep,
  onSaved,
  onCancel,
}: {
  client: Parameters<typeof createSalesRep>[0];
  rep?: AdminSalesRep;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { showNotification } = useNotifications();
  const form = useForm<SalesRepInput>({
    resolver: zodResolver(salesRepInputSchema),
    defaultValues: { firstName: rep?.firstName ?? '', lastName: rep?.lastName ?? '' },
  });
  const save = form.handleSubmit(async (input) => {
    try {
      if (rep) await updateSalesRep(client, rep.externalId, input);
      else await createSalesRep(client, input);
      showNotification({
        message: rep ? 'Sales Rep updated.' : 'Sales Rep created.',
        severity: 'success',
      });
      onSaved();
    } catch (error) {
      if (error instanceof SessionCancelled) return;
      showNotification({ message: safeError(error).message, severity: 'error' });
    }
  });
  return (
    <Stack
      component="form"
      spacing={2}
      noValidate
      onSubmit={save}
      aria-label={rep ? 'Edit Sales Rep' : 'Create Sales Rep'}
    >
      <TextField
        label="First name"
        {...form.register('firstName')}
        disabled={form.formState.isSubmitting}
        error={!!form.formState.errors.firstName}
        helperText={form.formState.errors.firstName?.message}
        autoFocus
      />
      <TextField
        label="Last name"
        {...form.register('lastName')}
        disabled={form.formState.isSubmitting}
        error={!!form.formState.errors.lastName}
        helperText={form.formState.errors.lastName?.message}
      />
      {form.formState.errors.root?.message && (
        <Alert severity="error">{form.formState.errors.root.message}</Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={form.formState.isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving…' : rep ? 'Save changes' : 'Create Sales Rep'}
        </Button>
      </Stack>
    </Stack>
  );
}
