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
])('rejects malformed aggregate data without manufacturing zeros: %j', async (override) => {
  const client = new ApiClient('http://localhost:3000');
  vi.spyOn(client, 'request').mockResolvedValue({ ...emptyOverview, ...override });
  await expect(getOverview(client, new AbortController().signal)).rejects.toThrow(
    'unexpected overview response',
  );
});
