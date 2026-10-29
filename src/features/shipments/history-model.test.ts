import { ApiClient } from '@api/api';
import { expect, it } from 'vitest';
import { getShipmentHistory } from './api';
import { detailSearch, detailSearchSchema, snapshotDifferences } from './history-model';
import type { TrackingSnapshot } from './schemas';

const first: TrackingSnapshot = {
  externalId: '30000000-0000-4000-8000-000000000001',
  observedAt: '2026-10-16T14:00:00Z',
  carrierStatus: 'In transit',
  carrierStatusDetail: null,
  pickedUpOn: '2026-10-15',
  estimatedDeliveryOn: null,
  deliveredOn: null,
};
it('preserves invalid URL inputs and supplies defaults only for absent values', () => {
  expect(detailSearchSchema.parse(detailSearch({}))).toEqual({
    tab: 'overview',
    page: 1,
    pageSize: 25,
  });
  expect(detailSearchSchema.parse(detailSearch({ tab: 'audit' })).tab).toBe('audit');
  for (const raw of [
    { tab: 'invalid' },
    { page: '0' },
    { page: '1.5' },
    { page: '-1' },
    { page: '9007199254740991' },
    { pageSize: '10' },
    { page: ['2'] },
  ]) {
    expect(detailSearchSchema.safeParse(detailSearch(raw)).success).toBe(false);
  }
  expect(detailSearch({ tab: 'invalid', returnTo: 'https://evil.example' })).toMatchObject({
    tab: 'invalid',
    returnTo: '/shipments',
  });
});
it('compares normalized fields including transitions to/from null, without inventing boundary context', () => {
  const next = {
    ...first,
    carrierStatusDetail: 'Departed',
    pickedUpOn: null,
    estimatedDeliveryOn: '2026-10-20',
  };
  expect(snapshotDifferences(next, first)).toEqual([
    { field: 'carrierStatusDetail', label: 'Status detail', before: null, after: 'Departed' },
    { field: 'pickedUpOn', label: 'Pickup', before: '2026-10-15', after: null },
    {
      field: 'estimatedDeliveryOn',
      label: 'Estimated delivery',
      before: null,
      after: '2026-10-20',
    },
  ]);
  expect(snapshotDifferences(next)).toEqual([]);
  expect(
    snapshotDifferences({ ...first, externalId: 'another-id', observedAt: 'another-time' }, first),
  ).toEqual([]);
});
it('reads credentialed, cancellable history pages and rejects mismatched/malformed envelopes', async () => {
  const client = new ApiClient('');
  const signal = new AbortController().signal;
  let response: unknown = { items: [first], page: 1, pageSize: 25, total: 1 };
  client.http.defaults.adapter = async (config) => {
    expect(config.url).toBe(`/shipments/${first.externalId}/history`);
    expect(config.params).toEqual({ page: 1, pageSize: 25 });
    expect(config.withCredentials).toBe(true);
    expect(config.signal).toBeDefined();
    return { config, status: 200, statusText: '', headers: {}, data: response };
  };
  expect((await getShipmentHistory(client, first.externalId, 1, 25, signal)).items).toEqual([
    first,
  ]);
  for (const malformed of [
    { items: [first], page: 2, pageSize: 25, total: 26 },
    { items: [first], page: 1, pageSize: 50, total: 1 },
    { items: [], page: 1, pageSize: 25, total: 1 },
    { items: [first, first], page: 1, pageSize: 25, total: 2 },
    { items: [{ ...first, pickedUpOn: '2026-02-30' }], page: 1, pageSize: 25, total: 1 },
  ]) {
    response = malformed;
    await expect(getShipmentHistory(client, first.externalId, 1, 25, signal)).rejects.toThrow(
      'unexpected',
    );
  }
});
