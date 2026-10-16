import { z } from 'zod';

export const tabs = {
  all: 'All shipments',
  active: 'Active',
  paused: 'Paused',
  delivered: 'Delivered',
  attention: 'Needs attention',
} as const;
export const outcomes = {
  never_checked: 'Never checked',
  found: 'Found',
  not_found: 'Not found',
  failed: 'Failed',
  skipped: 'Skipped',
} as const;
export const sorts = {
  createdAt: 'Created',
  trackingReference: 'Reference',
  estimatedDeliveryOn: 'Delivery',
  lastAttemptedAt: 'Last attempted',
} as const;
export type SearchState = Record<string, string>;
const optionalText = (schema: z.ZodType<string>) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
const date = z.iso.date().refine((value) => !value.startsWith('0000'), 'Use a year after 0000.');
const integer = z
  .string()
  .regex(/^[1-9]\d*$/, 'Use a positive whole number.')
  .transform(Number)
  .pipe(z.number().int().safe());
export const searchSchema = z
  .strictObject({
    tab: z.enum(['all', 'active', 'paused', 'delivered', 'attention']).default('active'),
    q: optionalText(
      z
        .string()
        .trim()
        .max(255)
        .refine((value) => !value.includes('\0'), 'Remove null characters.'),
    ),
    carrierExternalId: optionalText(z.uuidv4()),
    lookupOutcome: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['never_checked', 'found', 'not_found', 'failed', 'skipped']).optional(),
    ),
    createdFrom: optionalText(date),
    createdTo: optionalText(date),
    estimatedDeliveryFrom: optionalText(date),
    estimatedDeliveryTo: optionalText(date),
    undeliveredOnly: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    page: integer.default(1),
    pageSize: z.enum(['25', '50', '100']).default('25').transform(Number),
    sortBy: z
      .enum(['createdAt', 'trackingReference', 'estimatedDeliveryOn', 'lastAttemptedAt'])
      .default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
  })
  .superRefine((value, context) => {
    if (!Number.isSafeInteger((value.page - 1) * value.pageSize))
      context.addIssue({ code: 'custom', path: ['page'], message: 'Page is too large.' });
    for (const [from, to] of [
      ['createdFrom', 'createdTo'],
      ['estimatedDeliveryFrom', 'estimatedDeliveryTo'],
    ] as const) {
      if (value[from] && value[to] && value[from] > value[to])
        context.addIssue({
          code: 'custom',
          path: [to],
          message: 'End date must be on or after start date.',
        });
    }
  });
export type ShipmentSearch = z.infer<typeof searchSchema>;

/** Keep invalid values editable instead of discarding the staff member's intent. */
export function readSearch(raw: Record<string, unknown>): SearchState {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : (JSON.stringify(value) ?? ''),
    ]),
  );
}
export function searchErrors(raw: SearchState): Record<string, string> {
  const result = searchSchema.safeParse(raw);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys')
      for (const key of issue.keys) errors[key] = 'Unknown filter. Remove it to continue.';
    else errors[String(issue.path[0])] = issue.message;
  }
  return errors;
}
export function changeSearch(
  raw: SearchState,
  changes: Record<string, string | undefined>,
  resetPage = true,
): SearchState {
  const next = {
    ...raw,
    ...changes,
    ...(resetPage && !searchErrors(raw).page ? { page: '1' } : {}),
  };
  return Object.fromEntries(
    Object.entries(next).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '',
    ),
  );
}
export function listReturnTo(value: unknown) {
  if (typeof value !== 'string') return '/shipments';
  try {
    const url = new URL(value, 'https://internal.invalid');
    return url.origin === 'https://internal.invalid' &&
      url.pathname === '/shipments' &&
      value.startsWith('/shipments')
      ? `${url.pathname}${url.search}`
      : '/shipments';
  } catch {
    return '/shipments';
  }
}
