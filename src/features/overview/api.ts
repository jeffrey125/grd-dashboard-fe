import { type ApiClient, ApiError } from '@api/api';
import { shipmentSchema, trackingSnapshotSchema } from '@features/shipments/contracts';
import { z } from 'zod';

const count = z.number().int().nonnegative().safe();
const date = z.iso.date().refine((value) => !value.startsWith('0000'));
const panel = z.object({ total: count, items: z.array(shipmentSchema).max(10) });
export const overviewSchema = z
  .object({
    asOf: z.iso.datetime({ offset: true }),
    timezone: z.literal('America/New_York'),
    upcomingWindow: z.object({ from: date, to: date }).refine((value) => value.from <= value.to),
    counts: z.object({
      all: count,
      active: count,
      paused: count,
      delivered: count,
      attention: count,
    }),
    attention: panel,
    upcomingDeliveries: panel,
    recentChanges: z
      .array(
        z.object({
          shipmentExternalId: z.uuidv4(),
          trackingReference: z.string(),
          carrier: z.object({ externalId: z.uuidv4(), code: z.string(), name: z.string() }),
          snapshot: trackingSnapshotSchema,
        }),
      )
      .max(10),
  })
  .refine(
    (data) =>
      data.attention.total === data.counts.attention &&
      [data.attention, data.upcomingDeliveries].every(
        (value) => value.items.length === Math.min(10, value.total),
      ),
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

export function upcomingSearch(window: Overview['upcomingWindow']) {
  return {
    tab: 'all',
    undeliveredOnly: 'true',
    estimatedDeliveryFrom: window.from,
    estimatedDeliveryTo: window.to,
    sortBy: 'estimatedDeliveryOn',
    sortDirection: 'asc',
  };
}
