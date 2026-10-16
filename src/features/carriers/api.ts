import { type ApiClient, ApiError } from '@api/api';
import { z } from 'zod';
import { carrierSchema, patchSchema, type Settings } from './schemas';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(0, 'The server returned unexpected carrier settings. Try again.');
  return parsed.data;
}
export async function getCarrierSettings(client: ApiClient, signal: AbortSignal) {
  return parse(z.array(carrierSchema), await client.request({ url: '/carriers', signal }));
}
export async function getCarrier(client: ApiClient, id: string, signal: AbortSignal) {
  const carrier = parse(
    carrierSchema,
    await client.request({ url: `/carriers/${z.uuidv4().parse(id)}`, signal }),
  );
  if (carrier.externalId.toLowerCase() !== id.toLowerCase())
    throw new ApiError(0, 'The server returned a different carrier. Try again.');
  return carrier;
}
export async function updateCarrier(client: ApiClient, id: string, input: Partial<Settings>) {
  const carrier = parse(
    carrierSchema,
    await client.request({
      url: `/carriers/${z.uuidv4().parse(id)}`,
      method: 'PATCH',
      data: patchSchema.parse(input),
    }),
  );
  if (carrier.externalId.toLowerCase() !== id.toLowerCase())
    throw new ApiError(0, 'The server returned a different carrier. Reload before retrying.');
  return carrier;
}
