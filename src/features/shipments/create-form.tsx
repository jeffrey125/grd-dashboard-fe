import { SessionCancelled, safeError } from '@api/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { businessCalendarDate } from '@lib/dates';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import type { CreateShipmentResult } from './api';
import {
  type CreateShipmentInput,
  createShipmentSchema,
  fieldErrorMessages,
  type ShipmentDraft,
  ShipmentValidationError,
} from './create-schema';
import { manualStatuses } from './manual-tracking';
import type { carrierSchema } from './schemas';

const emptyShipment = (carrierExternalId = '', manual = false): ShipmentDraft => ({
  manualTracking: manual
    ? { carrierStatus: 'Pending Pickup', pickedUpOn: '', estimatedDeliveryOn: '' }
    : undefined,
  carrierExternalId,
  trackingReference: '',
  notes: '',
  salesRepExternalId: '',
  followUpOn: '',
});

export function CreateShipmentForm({
  carriers,
  salesReps,
  unavailable,
  onCreate,
  onSaved,
  onCarrierError,
}: {
  carriers: z.infer<typeof carrierSchema>[];
  salesReps: Array<{ externalId: string; firstName: string; lastName: string; active: boolean }>;
  unavailable: boolean;
  onCreate: (input: CreateShipmentInput) => Promise<CreateShipmentResult>;
  onSaved: (result: CreateShipmentResult) => void;
  onCarrierError: () => void;
}) {
  const { register, watch, handleSubmit, setError, reset, formState } = useForm<
    ShipmentDraft,
    unknown,
    CreateShipmentInput
  >({
    defaultValues: emptyShipment(),
    resolver: zodResolver(createShipmentSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const selectedCarrier = carriers.find(
    (carrier) => carrier.externalId === watch('carrierExternalId'),
  );
  const manual = selectedCarrier?.code === 'other';
  const [failure, setFailure] = useState('');
  const busy = useRef(false);
  const { errors, isSubmitting: pending } = formState;

  const submit = handleSubmit(async (input) => {
    setFailure('');
    const selected = carriers.find(
      (carrier) => carrier.externalId === input.carrierExternalId && carrier.isActive,
    );
    if (unavailable || !selected) {
      setError('carrierExternalId', { message: fieldErrorMessages.carrierExternalId });
      return;
    }
    try {
      const result = await onCreate({
        ...input,
        manualTracking: selected.code === 'other' ? input.manualTracking : undefined,
      });
      reset(emptyShipment(input.carrierExternalId, selected.code === 'other'));
      onSaved(result);
    } catch (error) {
      if (error instanceof SessionCancelled) return;
      setFailure(safeError(error).message);
      if (error instanceof ShipmentValidationError) {
        for (const detail of error.fields) {
          const field = detail.field === 'shipment' ? 'trackingReference' : detail.field;
          setError(
            field,
            { type: 'server', message: fieldErrorMessages[detail.field] },
            { shouldFocus: true },
          );
        }
        if (error.fields.some((detail) => detail.field === 'carrierExternalId')) onCarrierError();
      }
    }
  });

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Add shipment
      </Typography>
      {failure && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {failure}
        </Alert>
      )}
      <Box
        component="form"
        aria-label="Add shipment"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (busy.current) return;
          busy.current = true;
          void submit(event).finally(() => {
            busy.current = false;
          });
        }}
        sx={{
          display: 'grid',
          gap: 2,
          alignItems: 'start',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
          },
        }}
      >
        <TextField
          select
          fullWidth
          label="Carrier"
          {...register('carrierExternalId')}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          disabled={pending || unavailable}
          error={!!errors.carrierExternalId}
          helperText={errors.carrierExternalId?.message}
        >
          <option value="">Choose carrier</option>
          {carriers
            .filter((carrier) => carrier.isActive)
            .map((carrier) => (
              <option key={carrier.externalId} value={carrier.externalId}>
                {carrier.name}
              </option>
            ))}
        </TextField>
        <TextField
          fullWidth
          label="Tracking reference"
          {...register('trackingReference')}
          disabled={pending}
          error={!!errors.trackingReference}
          helperText={errors.trackingReference?.message}
          slotProps={{ htmlInput: { autoCapitalize: 'none', spellCheck: false } }}
        />
        <TextField
          fullWidth
          label="Notes (optional)"
          {...register('notes')}
          disabled={pending}
          error={!!errors.notes}
          helperText={errors.notes?.message}
        />
        <TextField
          select
          fullWidth
          label="Assigned Sales Rep (optional)"
          {...register('salesRepExternalId')}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          disabled={pending}
          error={!!errors.salesRepExternalId}
          helperText={errors.salesRepExternalId?.message}
        >
          <option value="">Unassigned</option>
          {salesReps
            .filter((rep) => rep.active)
            .map((rep) => (
              <option key={rep.externalId} value={rep.externalId}>
                {rep.firstName} {rep.lastName}
              </option>
            ))}
        </TextField>
        <TextField
          fullWidth
          type="date"
          label="Date to Follow Up (optional)"
          {...register('followUpOn')}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { min: businessCalendarDate() },
          }}
          disabled={pending}
          error={!!errors.followUpOn}
          helperText={errors.followUpOn?.message}
        />
        {manual && (
          <>
            <TextField
              select
              label="Carrier Status"
              defaultValue="Pending Pickup"
              {...register('manualTracking.carrierStatus', { shouldUnregister: true })}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              disabled={pending}
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
                defaultValue=""
                {...register(`manualTracking.${field}`, { shouldUnregister: true })}
                slotProps={{ inputLabel: { shrink: true } }}
                disabled={pending}
                error={!!errors.manualTracking?.[field]}
                helperText={errors.manualTracking?.[field]?.message}
              />
            ))}
          </>
        )}
        <Button
          type="submit"
          variant="contained"
          disabled={pending || unavailable}
          sx={{ minHeight: 56, whiteSpace: 'nowrap' }}
        >
          {pending ? 'Adding…' : 'Add shipment'}
        </Button>
      </Box>
    </Paper>
  );
}
