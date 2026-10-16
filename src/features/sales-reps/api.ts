import { type ApiClient, ApiError } from '@api/api';
import { z } from 'zod';
import {
  adminSalesRepSchema,
  type SalesRepInput,
  salesRepInputSchema,
  salesRepSchema,
} from './schemas';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(0, 'The server returned unexpected Sales Rep data. Try again.');
  return result.data;
}

export async function listSalesReps(client: ApiClient, signal: AbortSignal) {
  return parse(
    z.array(adminSalesRepSchema),
    await client.request({ url: '/admin/sales-reps', signal }),
  );
}

export async function createSalesRep(client: ApiClient, input: SalesRepInput) {
  return parse(
    adminSalesRepSchema,
    await client.request({
      url: '/admin/sales-reps',
      method: 'POST',
      data: salesRepInputSchema.parse(input),
    }),
  );
}

export async function updateSalesRep(client: ApiClient, id: string, input: Partial<SalesRepInput>) {
  return parse(
    adminSalesRepSchema,
    await client.request({
      url: `/admin/sales-reps/${z.uuidv4().parse(id)}`,
      method: 'PATCH',
      data: salesRepInputSchema
        .partial()
        .refine((value) => Object.keys(value).length > 0)
        .parse(input),
    }),
  );
}

export async function deleteSalesRep(client: ApiClient, id: string) {
  await client.request({ url: `/admin/sales-reps/${z.uuidv4().parse(id)}`, method: 'DELETE' });
}

export async function restoreSalesRep(client: ApiClient, id: string) {
  return parse(
    adminSalesRepSchema,
    await client.request({
      url: `/admin/sales-reps/${z.uuidv4().parse(id)}/restore`,
      method: 'POST',
      data: {},
    }),
  );
}

export { salesRepSchema };
