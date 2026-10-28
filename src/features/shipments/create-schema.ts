import { ApiError } from '@api/api';
import { z } from 'zod';
import { manualTrackingDraftSchema } from './manual-tracking';

const literal = (max: number) =>
  z
    .string()
    .trim()
    .refine((value) => value.length <= max, `Use at most ${max} characters.`)
    .refine((value) => !value.includes('\0'), 'Remove null characters.');

export const createShipmentSchema = z.strictObject({
  manualTracking: manualTrackingDraftSchema.optional(),
  carrierExternalId: z
    .uuidv4('Choose an enabled carrier.')
    .transform((value) => value.toLowerCase()),
  trackingReference: literal(255).refine(
    (value) => value.length > 0,
    'Enter a tracking reference.',
  ),
  notes: literal(500).transform((value) => value || null),
  salesRepExternalId: z
    .union([z.uuidv4(), z.literal('')])
    .optional()
    .transform((value) => (value === '' ? null : value)),
  followUpOn: z
    .union([z.iso.date(), z.literal('')])
    .optional()
    .transform((value) => (value === '' ? null : value)),
});

export type ShipmentDraft = z.input<typeof createShipmentSchema>;
export type CreateShipmentInput = z.output<typeof createShipmentSchema>;

const fieldErrorsSchema = z.object({
  code: z.literal('shipment_validation_failed'),
  details: z
    .array(
      z.object({
        field: z.enum([
          'carrierExternalId',
          'trackingReference',
          'notes',
          'salesRepExternalId',
          'followUpOn',
          'shipment',
        ]),
      }),
    )
    .min(1)
    .max(10),
});

export class ShipmentValidationError extends ApiError {
  constructor(readonly fields: z.infer<typeof fieldErrorsSchema>['details']) {
    super(400, 'Correct the marked fields and try again.');
  }
}

export function shipmentValidationError(status: number, body: unknown) {
  if (status !== 400) return;
  const parsed = fieldErrorsSchema.safeParse(body);
  if (parsed.success) return new ShipmentValidationError(parsed.data.details);
}

export const fieldErrorMessages = {
  carrierExternalId: 'Carrier is unavailable. Choose an enabled carrier.',
  trackingReference: 'Check this tracking reference.',
  notes: 'Check these notes.',
  salesRepExternalId: 'Choose an active Sales Rep.',
  followUpOn: 'Choose today or a future date.',
  shipment: 'Check this shipment.',
} as const;
