import { type ApiClient, ApiError } from '@api/api';
import { z } from 'zod';
import { carrierSchema, runSchema, searchResponseSchema, shipmentSchema } from './schemas';
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
