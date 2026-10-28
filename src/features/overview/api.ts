import { type ApiClient, ApiError } from '@api/api';
import { shipmentSchema } from '@features/shipments/contracts';
import { parseCalendarDate } from '@lib/dates';
import { z } from 'zod';

const count = z.number().int().nonnegative().safe();
const panel = z.object({ total: count, items: z.array(shipmentSchema).max(5) });
export const overviewSchema = z
  .object({
    asOf: z.iso.datetime({ offset: true }),
    timezone: z.literal('America/New_York'),
    counts: z.object({
      other: count.default(0),
      all: count,
      active: count,
      paused: count,
      delivered: count,
      attention: count,
    }),
    attention: panel,
    upcomingWindow: z
      .object({ from: z.iso.date(), to: z.iso.date() })
      .refine(
        (window) => parseCalendarDate(window.from).add(6, 'day').format('YYYY-MM-DD') === window.to,
      ),
    upcomingDeliveries: panel,
  })
  .refine(
    (data) =>
      data.attention.total === data.counts.attention &&
      data.attention.items.length === Math.min(5, data.attention.total) &&
      data.upcomingDeliveries.items.length === Math.min(5, data.upcomingDeliveries.total) &&
      data.upcomingDeliveries.items.every(
        (row) =>
          row.monitoringStatus !== 'completed' &&
          !row.currentTracking?.deliveredOn &&
          !!row.currentTracking?.estimatedDeliveryOn &&
          row.currentTracking.estimatedDeliveryOn >= data.upcomingWindow.from &&
          row.currentTracking.estimatedDeliveryOn <= data.upcomingWindow.to,
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
