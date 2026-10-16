import { ApiClient } from '@api/api';
import { searchSchema } from '@features/shipments/search-state';
import { emptyOverview, overviewFixture } from '@test/overview-fixture';
import { expect, it, vi } from 'vitest';
import { getOverview, overviewSchema, upcomingSearch } from './api';

it('requests the aggregate endpoint with cancellation and preserves server totals', async () => {
  const client = new ApiClient('http://localhost:3000');
  const request = vi.spyOn(client, 'request').mockResolvedValue(overviewFixture());
  const signal = new AbortController().signal;
  const data = await getOverview(client, signal);
  expect(request).toHaveBeenCalledWith({ url: '/dashboard/overview', signal });
  expect(data.counts.all).toBe(1200);
  expect(data.attention.items).toHaveLength(1);
  expect(data.attention.items[0]?.trackingReference).toBe('000012345678901234567890');
});

it.each([
  { counts: { ...emptyOverview.counts, all: -1 } },
  { timezone: 'UTC' },
  { upcomingWindow: { from: '2026-02-30', to: '2026-03-06' } },
  { upcomingWindow: { from: '2026-10-22', to: '2026-10-16' } },
  { attention: { total: 1, items: [] } },
  { upcomingDeliveries: { total: 1, items: [] } },
  { recentChanges: Array(11).fill(overviewFixture().recentChanges[0]) },
])('rejects malformed aggregate data without manufacturing zeros: %j', async (override) => {
  const client = new ApiClient('http://localhost:3000');
  vi.spyOn(client, 'request').mockResolvedValue({ ...emptyOverview, ...override });
  await expect(getOverview(client, new AbortController().signal)).rejects.toThrow(
    'unexpected overview response',
  );
});

it.each([
  ['2026-03-08T04:59:59Z', '2026-03-07', '2026-03-13'],
  ['2026-03-08T05:00:00Z', '2026-03-08', '2026-03-14'],
  ['2026-11-01T03:59:59Z', '2026-10-31', '2026-11-06'],
  ['2026-11-01T04:00:00Z', '2026-11-01', '2026-11-07'],
])('uses the server calendar window without local timezone arithmetic at %s', (asOf, from, to) => {
  const data = overviewSchema.parse({ ...emptyOverview, asOf, upcomingWindow: { from, to } });
  expect(searchSchema.parse(upcomingSearch(data.upcomingWindow))).toMatchObject({
    tab: 'all',
    undeliveredOnly: true,
    estimatedDeliveryFrom: from,
    estimatedDeliveryTo: to,
    sortBy: 'estimatedDeliveryOn',
    sortDirection: 'asc',
    page: 1,
  });
});
