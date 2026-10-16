import { type ApiClient, ApiError } from '@api/api';
import { z } from 'zod';
import { type CreateShipmentInput, shipmentValidationError } from './create-schema';
import {
  carrierSchema,
  historyResponseSchema,
  runSchema,
  runStatusSchema,
  searchResponseSchema,
  shipmentSchema,
} from './schemas';
import type { ShipmentSearch } from './search-state';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(0, 'The server returned an unexpected shipment response. Try again.');
  return result.data;
}
export async function searchShipments(
  client: ApiClient,
  search: ShipmentSearch,
  signal: AbortSignal,
) {
  return parse(
    searchResponseSchema,
    await client.request({ url: '/shipments/search', params: search, signal }),
  );
}
export async function getCarriers(client: ApiClient, signal: AbortSignal) {
  return parse(z.array(carrierSchema), await client.request({ url: '/carriers', signal }));
}
export async function getShipment(client: ApiClient, id: string, signal: AbortSignal) {
  return parse(shipmentSchema, await client.request({ url: `/shipments/${id}`, signal }));
}
export async function getShipmentHistory(
  client: ApiClient,
  id: string,
  page: number,
  pageSize: number,
  signal: AbortSignal,
) {
  const response = parse(
    historyResponseSchema,
    await client.request({ url: `/shipments/${id}/history`, params: { page, pageSize }, signal }),
  );
  // Never label another page's items with the requested URL's pagination state.
  if (
    response.page !== page ||
    response.pageSize !== pageSize ||
    response.items.length !==
      Math.max(0, Math.min(pageSize, response.total - (page - 1) * pageSize)) ||
    new Set(response.items.map((item) => item.externalId)).size !== response.items.length
  )
    throw new ApiError(0, 'The server returned an unexpected history page. Try again.');
  return response;
}
export async function saveShipmentNotes(client: ApiClient, id: string, notes: string | null) {
  return parse(
    shipmentSchema,
    await client.request({
      url: `/shipments/${id}`,
      method: 'PATCH',
      data: { notes },
    }),
  );
}
export async function deleteShipment(client: ApiClient, id: string) {
  await client.request({ url: `/shipments/${id}`, method: 'DELETE' });
}
export async function getRun(client: ApiClient, id: string, signal: AbortSignal) {
  return parse(runStatusSchema, await client.request({ url: `/tracking-runs/${id}`, signal }));
}
const createResponseSchema = z.object({
  outcome: z.enum(['created', 'existing']),
  shipment: shipmentSchema,
});
export type CreateShipmentResult = z.infer<typeof createResponseSchema>;
export async function createShipment(client: ApiClient, input: CreateShipmentInput) {
  return parse(
    createResponseSchema,
    await client.request({
      url: '/shipments',
      method: 'POST',
      data: input,
      mapError: shipmentValidationError,
    }),
  );
}
export async function shipmentCommand(
  client: ApiClient,
  id: string,
  command: 'pause' | 'resume' | 'refresh',
) {
  const response = await client.request({
    url: `/shipments/${id}/${command}`,
    method: 'POST',
    data: {},
  });
  return command === 'refresh' ? parse(runSchema, response) : parse(shipmentSchema, response);
}
