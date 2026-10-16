import type { Overview } from '@features/overview/api';
import { shipmentFixture } from './shipment-fixture';

export const emptyOverview: Overview = {
  asOf: '2026-10-16T14:00:00.000Z',
  timezone: 'America/New_York',
  upcomingWindow: { from: '2026-10-16', to: '2026-10-22' },
  counts: { all: 0, active: 0, paused: 0, delivered: 0, attention: 0 },
  attention: { total: 0, items: [] },
  upcomingDeliveries: { total: 0, items: [] },
  recentChanges: [],
};
export function overviewFixture(): Overview {
  const row = shipmentFixture(1, {
    trackingReference: '000012345678901234567890',
    monitoringStatus: 'paused',
    monitoringReason: 'not_found_threshold',
    currentTracking: {
      externalId: '30000000-0000-4000-8000-000000000001',
      carrierStatus: 'In transit',
      carrierStatusDetail: null,
      pickedUpOn: null,
      estimatedDeliveryOn: '2026-10-20',
      deliveredOn: null,
      observedAt: '2026-10-16T14:00:00.000Z',
    },
    latestLookup: {
      runExternalId: '40000000-0000-4000-8000-000000000001',
      outcome: 'failed',
      snapshotChanged: false,
      retryable: true,
      reasonCode: 'PRIVATE_DIAGNOSTIC',
      completedAt: '2026-10-16T14:01:00.000Z',
    },
  });
  if (!row.currentTracking) throw new Error('Overview fixture requires tracking.');
  return {
    ...emptyOverview,
    counts: { all: 1200, active: 1100, paused: 80, delivered: 20, attention: 1 },
    attention: { total: 1, items: [row] },
    upcomingDeliveries: { total: 1, items: [row] },
    recentChanges: [
      {
        shipmentExternalId: row.externalId,
        trackingReference: row.trackingReference,
        carrier: row.carrier,
        snapshot: row.currentTracking,
      },
    ],
  };
}
