import { SessionCancelled, safeError } from '@api/api';
import { zodResolver } from '@hookform/resolvers/zod';
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
import type { carrierSchema } from './schemas';

const emptyShipment = (carrierExternalId = ''): ShipmentDraft => ({
  carrierExternalId,
  trackingReference: '',
  notes: '',
});

export function CreateShipmentForm({
  carriers,
  unavailable,
  onCreate,
  onSaved,
  onCarrierError,
}: {
  carriers: z.infer<typeof carrierSchema>[];
  unavailable: boolean;
  onCreate: (input: CreateShipmentInput) => Promise<CreateShipmentResult>;
  onSaved: (result: CreateShipmentResult) => void;
  onCarrierError: () => void;
}) {
  const { register, handleSubmit, setError, reset, formState } = useForm<
    ShipmentDraft,
    unknown,
    CreateShipmentInput
  >({
    defaultValues: emptyShipment(),
    resolver: zodResolver(createShipmentSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
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
      const result = await onCreate(input);
      reset(emptyShipment(input.carrierExternalId));
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
            md: 'minmax(12rem, 0.9fr) minmax(14rem, 1.25fr) minmax(14rem, 1.35fr) auto',
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
