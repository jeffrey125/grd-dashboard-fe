import { ApiClient } from '@api/api';
import { emptyOverview, overviewFixture } from '@test/overview-fixture';
import { expect, it, vi } from 'vitest';
import { getOverview } from './api';

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
  { attention: { total: 1, items: [] } },
  { upcomingWindow: { from: '2026-02-30', to: '2026-03-06' } },
  { upcomingWindow: { from: '2026-10-16', to: '2026-10-30' } },
  { upcomingDeliveries: { total: 1, items: [] } },
  {
    upcomingDeliveries: {
      total: 1,
      items: [{ ...overviewFixture().upcomingDeliveries.items[0], monitoringStatus: 'completed' }],
    },
  },
])('rejects malformed aggregate data without manufacturing zeros: %j', async (override) => {
  const client = new ApiClient('http://localhost:3000');
  vi.spyOn(client, 'request').mockResolvedValue({ ...emptyOverview, ...override });
  await expect(getOverview(client, new AbortController().signal)).rejects.toThrow(
    'unexpected overview response',
  );
});

it('keeps upcoming date-only values unchanged and rejects items outside the server window', async () => {
  const client = new ApiClient('http://localhost:3000');
  const fixture = overviewFixture();
  const request = vi.spyOn(client, 'request').mockResolvedValue(fixture);
  const data = await getOverview(client, new AbortController().signal);
  expect(data.upcomingWindow).toEqual({ from: '2026-10-16', to: '2026-10-22' });
  expect(data.upcomingDeliveries.items[0]?.currentTracking?.estimatedDeliveryOn).toBe('2026-10-20');
  request.mockResolvedValue({
    ...fixture,
    upcomingWindow: { from: '2026-10-01', to: '2026-10-07' },
  });
  await expect(getOverview(client, new AbortController().signal)).rejects.toThrow(
    'unexpected overview response',
  );
});
