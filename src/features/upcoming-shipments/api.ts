import { type ApiClient, ApiError } from '@api/api';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

const repId = z.string().regex(/^rec[A-Za-z0-9]{14}$/);
const rep = z.object({ id: repId, name: z.string() });
const accessSchema = z.object({
  enabled: z.boolean(),
  administrator: z.boolean(),
  repIds: z.array(repId),
  from: z.iso.date(),
  month: z.string(),
  monthEnd: z.iso.date(),
  weekEnd: z.iso.date(),
  through: z.iso.date(),
  timezone: z.literal('America/Chicago'),
});
const orderSchema = z.object({
  id: repId,
  requestedShipOn: z.iso.date(),
  salesOrders: z.array(z.string()),
  customer: z.string(),
  customerPo: z.string().nullable(),
  repIds: z.array(repId),
  reps: z.array(z.string()),
  tracking: z.string().nullable(),
  notes: z.string().nullable(),
  pallets: z.number().nullable(),
  lines: z.array(
    z.object({
      lineNumber: z.number().int(),
      product: z.string(),
      vendor: z.string(),
      purchaseOrder: z.string().nullable(),
      pounds: z.number().nullable(),
      units: z.number().nullable(),
      origin: z.string().nullable(),
    }),
  ),
  airtableUrl: z
    .string()
    .regex(/^https:\/\/airtable\.com\/appxyP3yY5YF9plDO\/tbl7X5ROha1PzgGZt\/rec[A-Za-z0-9]{14}$/),
});
const upcomingSchema = accessSchema.extend({
  window: z.enum(['week', 'month']),
  updatedAt: z.iso.datetime(),
  stale: z.boolean(),
  total: z.number().int().nonnegative(),
  reps: z.array(rep),
  orders: z.array(orderSchema),
});
export type UpcomingOrder = z.infer<typeof orderSchema>;
export type UpcomingData = z.infer<typeof upcomingSchema>;
const assignmentSchema = z.object({ ownRepId: repId.nullable(), assignedRepIds: z.array(repId) });
const accountAccessSchema = assignmentSchema.extend({
  configured: z.boolean(),
  directoryUnavailable: z.boolean().default(false),
  reps: z.array(rep.extend({ email: z.string().nullable() })),
  suggestedRepIds: z.array(repId),
});

function parse<T>(schema: z.ZodType<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) throw new ApiError(502, 'Upcoming shipments returned an invalid response.');
  return result.data;
}

export function useUpcomingAccess(
  client: ApiClient,
  accountId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['upcoming-access', accountId],
    queryFn: async ({ signal }) =>
      parse(accessSchema, await client.request({ url: '/upcoming-shipments/access', signal })),
    enabled: enabled && Boolean(accountId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

export async function getUpcoming(
  client: ApiClient,
  window: 'week' | 'month',
  signal?: AbortSignal,
  refresh = false,
) {
  return parse(
    upcomingSchema,
    await client.request({
      url: '/upcoming-shipments',
      params: { window, ...(refresh ? { refresh: 'true' } : {}) },
      signal,
    }),
  );
}
export async function getUpcomingAssignments(client: ApiClient, id: string, signal: AbortSignal) {
  return parse(
    accountAccessSchema,
    await client.request({ url: `/admin/accounts/${id}/upcoming-shipments`, signal }),
  );
}
export async function saveUpcomingAssignments(
  client: ApiClient,
  id: string,
  data: z.infer<typeof assignmentSchema>,
) {
  return parse(
    assignmentSchema,
    await client.request({
      url: `/admin/accounts/${id}/upcoming-shipments`,
      method: 'PATCH',
      data: assignmentSchema.parse(data),
    }),
  );
}
