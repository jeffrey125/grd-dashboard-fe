import { SessionCancelled, safeError } from '@api/api';
import { useNotifications } from '@components/feedback/notification-provider';
import { useSession } from '@features/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { businessCalendarDate } from '@lib/dates';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { updateShipment } from './api';
import type { Shipment } from './schemas';

const assignmentSchema = z.strictObject({
  salesRepExternalId: z.union([z.uuidv4(), z.literal('')]),
  followUpOn: z.union([z.iso.date(), z.literal('')]),
});
type AssignmentDraft = z.input<typeof assignmentSchema>;
type AssignmentInput = z.output<typeof assignmentSchema>;

export function AssignmentSection({
  shipment,
  salesReps,
  disabled,
  onMissing,
  onDirty,
}: {
  shipment: Shipment;
  salesReps: Array<{ externalId: string; firstName: string; lastName: string; active: boolean }>;
  disabled: boolean;
  onMissing: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const { session } = useSession();
  const queries = useQueryClient();
  const { showNotification } = useNotifications();
  const submitting = useRef(false);
  const form = useForm<AssignmentDraft, unknown, AssignmentInput>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      salesRepExternalId: shipment.salesRep?.externalId ?? '',
      followUpOn: shipment.followUpOn ?? '',
    },
  });
  const draftRep = form.watch('salesRepExternalId');
  const draftFollowUp = form.watch('followUpOn');
  const dirty =
    draftRep !== (shipment.salesRep?.externalId ?? '') ||
    draftFollowUp !== (shipment.followUpOn ?? '');
  const mutation = useMutation({
    mutationKey: ['shipment-assignment', shipment.externalId],
    mutationFn: (input: AssignmentInput) =>
      updateShipment(session.client, shipment.externalId, {
        salesRepExternalId: input.salesRepExternalId || null,
        followUpOn: input.followUpOn || null,
      }),
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        queries.invalidateQueries({ queryKey: ['shipment', shipment.externalId] }),
        queries.invalidateQueries({ queryKey: ['shipments'] }),
        queries.invalidateQueries({ queryKey: ['overview'] }),
      ]);
    },
  });
  const options = useMemo(() => {
    if (
      !shipment.salesRep ||
      salesReps.some((rep) => rep.externalId === shipment.salesRep?.externalId)
    )
      return salesReps;
    return [shipment.salesRep, ...salesReps];
  }, [salesReps, shipment.salesRep]);

  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  useEffect(() => {
    if (!dirty && !mutation.isPending)
      form.reset({
        salesRepExternalId: shipment.salesRep?.externalId ?? '',
        followUpOn: shipment.followUpOn ?? '',
      });
  }, [dirty, form, mutation.isPending, shipment.followUpOn, shipment.salesRep]);

  const save = form.handleSubmit(async (input) => {
    if (submitting.current || disabled) return;
    submitting.current = true;
    try {
      await mutation.mutateAsync(input);
      showNotification({ message: 'Assignment and follow-up saved.', severity: 'success' });
    } catch (error) {
      if (error instanceof SessionCancelled) return;
      if (safeError(error).status === 404) onMissing();
      showNotification({ message: safeError(error).message, severity: 'error' });
    } finally {
      submitting.current = false;
    }
  });

  return (
    <Paper component="section" aria-labelledby="assignment-title" variant="outlined" sx={{ p: 2 }}>
      <Stack component="form" aria-label="Edit shipment assignment" spacing={2} onSubmit={save}>
        <Typography id="assignment-title" component="h2" variant="h6">
          Assignment &amp; follow-up
        </Typography>
        <TextField
          select
          label="Assigned Sales Rep"
          {...form.register('salesRepExternalId')}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          disabled={disabled || mutation.isPending}
          error={!!form.formState.errors.salesRepExternalId}
          helperText={form.formState.errors.salesRepExternalId?.message ?? 'Optional'}
        >
          <option value="">Unassigned</option>
          {options.map((rep) => (
            <option key={rep.externalId} value={rep.externalId}>
              {rep.firstName} {rep.lastName}
              {!rep.active ? ' (inactive)' : ''}
            </option>
          ))}
        </TextField>
        <TextField
          type="date"
          label="Date to Follow Up"
          {...form.register('followUpOn')}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { min: businessCalendarDate() },
          }}
          disabled={disabled || mutation.isPending}
          error={!!form.formState.errors.followUpOn}
          helperText={form.formState.errors.followUpOn?.message ?? 'Optional'}
        />
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            disabled={!dirty || disabled || mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Save assignment'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
