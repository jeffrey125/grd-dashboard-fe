import { z } from 'zod';
import type { TrackingSnapshot } from './schemas';
import { listReturnTo } from './search-state';

export function detailSearch(raw: Record<string, unknown>) {
  const text = (value: unknown, fallback: string) =>
    value === undefined
      ? fallback
      : typeof value === 'string'
        ? value
        : (JSON.stringify(value) ?? '');
  return {
    tab: text(raw.tab, 'overview'),
    page: text(raw.page, '1'),
    pageSize: text(raw.pageSize, '25'),
    returnTo: listReturnTo(raw.returnTo),
  };
}

export const detailSearchSchema = z
  .object({
    tab: z.enum(['overview', 'audit', 'history']),
    page: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .pipe(z.number().int().positive().safe()),
    pageSize: z.enum(['25', '50', '100']).transform(Number),
  })
  .refine((value) => Number.isSafeInteger((value.page - 1) * value.pageSize), {
    message: 'Page is too large.',
    path: ['page'],
  });

export const historyFields = {
  carrierStatus: 'Carrier status',
  carrierStatusDetail: 'Status detail',
  pickedUpOn: 'Pickup',
  estimatedDeliveryOn: 'Estimated delivery',
  deliveredOn: 'Actual delivery',
} as const;

/** Only pass neighbors from one response: separate offset reads can shift independently. */
export function snapshotDifferences(current: TrackingSnapshot, previous?: TrackingSnapshot) {
  if (!previous) return [];
  return (Object.keys(historyFields) as (keyof typeof historyFields)[])
    .filter((field) => current[field] !== previous[field])
    .map((field) => ({
      field,
      label: historyFields[field],
      before: previous[field],
      after: current[field],
    }));
}
