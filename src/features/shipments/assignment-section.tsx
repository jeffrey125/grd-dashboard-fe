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
import { shipmentTextDraftSchema, shipmentTextFields } from './create-schema';
import { manualStatuses, manualTrackingDraft, manualTrackingDraftSchema } from './manual-tracking';
import type { Shipment } from './schemas';

const assignmentSchema = z.strictObject({
  poNumber: shipmentTextDraftSchema,
  customer: shipmentTextDraftSchema,
  vendor: shipmentTextDraftSchema,
  manualTracking: manualTrackingDraftSchema.optional(),
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
      manualTracking: shipment.carrier.code === 'other' ? manualTrackingDraft(shipment) : undefined,
      poNumber: shipment.poNumber ?? '',
      customer: shipment.customer ?? '',
      vendor: shipment.vendor ?? '',
      salesRepExternalId: shipment.salesRep?.externalId ?? '',
      followUpOn: shipment.followUpOn ?? '',
    },
  });
  const dirty = form.formState.isDirty;
  const mutation = useMutation({
    mutationKey: ['shipment-assignment', shipment.externalId],
    mutationFn: (input: AssignmentInput) =>
      updateShipment(session.client, shipment.externalId, {
        manualTracking:
          shipment.carrier.code === 'other' && form.formState.dirtyFields.manualTracking
            ? input.manualTracking
            : undefined,
        poNumber: form.formState.dirtyFields.poNumber ? input.poNumber : undefined,
        customer: form.formState.dirtyFields.customer ? input.customer : undefined,
        vendor: form.formState.dirtyFields.vendor ? input.vendor : undefined,
        salesRepExternalId: form.formState.dirtyFields.salesRepExternalId
          ? input.salesRepExternalId || null
          : undefined,
        followUpOn: form.formState.dirtyFields.followUpOn ? input.followUpOn || null : undefined,
      }),
    retry: false,
    onSuccess: async (updated) => {
      form.reset({
        manualTracking: updated.carrier.code === 'other' ? manualTrackingDraft(updated) : undefined,
        poNumber: updated.poNumber ?? '',
        customer: updated.customer ?? '',
        vendor: updated.vendor ?? '',
        salesRepExternalId: updated.salesRep?.externalId ?? '',
        followUpOn: updated.followUpOn ?? '',
      });
      await Promise.all([
        queries.invalidateQueries({ queryKey: ['shipment', shipment.externalId] }),
        queries.invalidateQueries({ queryKey: ['shipments'] }),
        queries.invalidateQueries({ queryKey: ['history', shipment.externalId] }),
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
    if (!dirty && !mutation.isPending) {
      form.reset({
        manualTracking:
          shipment.carrier.code === 'other' ? manualTrackingDraft(shipment) : undefined,
        poNumber: shipment.poNumber ?? '',
        customer: shipment.customer ?? '',
        vendor: shipment.vendor ?? '',
        salesRepExternalId: shipment.salesRep?.externalId ?? '',
        followUpOn: shipment.followUpOn ?? '',
      });
    }
  }, [dirty, form, mutation.isPending, shipment]);

  const save = form.handleSubmit(async (input) => {
    if (submitting.current || disabled) return;
    submitting.current = true;
    try {
      await mutation.mutateAsync(input);
      showNotification({ message: 'Shipment changes saved.', severity: 'success' });
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
          {shipment.carrier.code === 'other' ? 'Manual shipment details' : 'Shipment details'}
        </Typography>
        {shipmentTextFields.map(({ name, label }) => (
          <TextField
            key={name}
            label={label}
            {...form.register(name)}
            disabled={disabled || mutation.isPending}
            error={!!form.formState.errors[name]}
            helperText={form.formState.errors[name]?.message ?? 'Optional'}
          />
        ))}
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
            htmlInput: {
              min:
                shipment.followUpOn && shipment.followUpOn < businessCalendarDate()
                  ? shipment.followUpOn
                  : businessCalendarDate(),
            },
          }}
          disabled={disabled || mutation.isPending}
          error={!!form.formState.errors.followUpOn}
          helperText={
            form.formState.errors.followUpOn?.message ??
            (shipment.carrier.code !== 'other' && shipment.currentTracking?.deliveredOn
              ? 'A future date keeps delivered shipments monitored until that date starts in New York. Clearing the date stops monitoring. Explicit pauses remain paused.'
              : 'Optional')
          }
        />
        {shipment.carrier.code === 'other' && (
          <>
            <TextField
              select
              label="Carrier Status"
              {...form.register('manualTracking.carrierStatus')}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              disabled={disabled || mutation.isPending}
            >
              {manualStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </TextField>
            {(
              [
                ['pickedUpOn', 'Pickup date'],
                ['estimatedDeliveryOn', 'Delivery date'],
              ] as const
            ).map(([field, label]) => (
              <TextField
                key={field}
                type="date"
                label={`${label} (optional)`}
                {...form.register(`manualTracking.${field}`)}
                slotProps={{ inputLabel: { shrink: true } }}
                disabled={disabled || mutation.isPending}
                error={!!form.formState.errors.manualTracking?.[field]}
                helperText={form.formState.errors.manualTracking?.[field]?.message}
              />
            ))}
          </>
        )}
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            disabled={!dirty || disabled || mutation.isPending}
          >
            {mutation.isPending
              ? 'Saving…'
              : shipment.carrier.code === 'other'
                ? 'Save changes'
                : 'Save assignment'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
