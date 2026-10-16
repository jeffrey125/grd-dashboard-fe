import { type ApiClient, ApiError } from '@api/api';
import { shipmentSchema } from '@features/shipments/contracts';
import { z } from 'zod';

const count = z.number().int().nonnegative().safe();
const panel = z.object({ total: count, items: z.array(shipmentSchema).max(5) });
export const overviewSchema = z
  .object({
    asOf: z.iso.datetime({ offset: true }),
    timezone: z.literal('America/New_York'),
    counts: z.object({
      all: count,
      active: count,
      paused: count,
      delivered: count,
      attention: count,
    }),
    attention: panel,
  })
  .refine(
    (data) =>
      data.attention.total === data.counts.attention &&
      data.attention.items.length === Math.min(5, data.attention.total),
  );
export type Overview = z.infer<typeof overviewSchema>;

export async function getOverview(client: ApiClient, signal: AbortSignal) {
  const result = overviewSchema.safeParse(
    await client.request({ url: '/dashboard/overview', signal }),
  );
  if (!result.success)
    throw new ApiError(0, 'The server returned an unexpected overview response. Try again.');
  return result.data;
}
