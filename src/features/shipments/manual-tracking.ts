import { z } from 'zod';
import type { Shipment } from './schemas';

export const manualStatuses = [
  'Pending Pickup',
  'Pickedup',
  'Out for delivery',
  'Delivered',
] as const;
const optionalDate = z
  .union([z.iso.date().refine((value) => !value.startsWith('0000')), z.literal('')])
  .transform((value) => value || null);
export const manualTrackingDraftSchema = z.strictObject({
  carrierStatus: z.enum(manualStatuses),
  pickedUpOn: optionalDate,
  estimatedDeliveryOn: optionalDate,
});
export function manualTrackingDraft(shipment: Shipment) {
  return {
    carrierStatus: z
      .enum(manualStatuses)
      .catch('Pending Pickup')
      .parse(shipment.currentTracking?.carrierStatus),
    pickedUpOn: shipment.currentTracking?.pickedUpOn ?? '',
    estimatedDeliveryOn: shipment.currentTracking?.estimatedDeliveryOn ?? '',
  };
}
