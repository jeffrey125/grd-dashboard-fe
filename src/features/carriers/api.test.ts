import { ApiClient } from '@api/api';
import { carrierFixture } from '@test/carrier-fixture';
import { expect, it, vi } from 'vitest';
import { getCarrier, getCarrierSettings, updateCarrier } from './api';

it('forwards cancellation and sends only supported changed fields', async () => {
  const client = new ApiClient('http://localhost:3000');
  const request = vi.spyOn(client, 'request').mockResolvedValue(carrierFixture);
  const signal = new AbortController().signal;
  await getCarrier(client, carrierFixture.externalId, signal);
  expect(request).toHaveBeenLastCalledWith({
    url: `/carriers/${carrierFixture.externalId}`,
    signal,
  });
  await updateCarrier(client, carrierFixture.externalId, { rateLimitPerMinute: null });
  expect(request).toHaveBeenLastCalledWith({
    url: `/carriers/${carrierFixture.externalId}`,
    method: 'PATCH',
    data: { rateLimitPerMinute: null },
  });
  request.mockResolvedValue([carrierFixture]);
  await expect(getCarrierSettings(client, signal)).resolves.toEqual([carrierFixture]);
});
it('rejects malformed and mismatched records', async () => {
  const client = new ApiClient('http://localhost:3000');
  const request = vi
    .spyOn(client, 'request')
    .mockResolvedValue({ ...carrierFixture, externalId: '22222222-2222-4222-8222-222222222222' });
  await expect(
    getCarrier(client, carrierFixture.externalId, new AbortController().signal),
  ).rejects.toThrow('different carrier');
  request.mockResolvedValue({ ...carrierFixture, pollIntervalMinutes: null });
  await expect(
    getCarrier(client, carrierFixture.externalId, new AbortController().signal),
  ).rejects.toThrow('unexpected carrier');
});
