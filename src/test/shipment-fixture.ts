import type { Shipment } from '@features/shipments/schemas';

export function shipmentFixture(index = 1, overrides: Partial<Shipment> = {}): Shipment {
  return {
    externalId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    carrier: {
      externalId: '10000000-0000-4000-8000-000000000001',
      name: 'UPS',
      code: 'ups',
      isActive: true,
    },
    trackingReference: `000${index}`,
    notes: null,
    verificationUrl: null,
    monitoringStatus: 'active',
    monitoringReason: null,
    lastAttemptedAt: null,
    nextCheckAt: null,
    consecutiveNotFoundCount: 0,
    createdAt: '2026-10-16T14:00:00.000Z',
    updatedAt: '2026-10-16T14:00:00.000Z',
    currentTracking: null,
    latestLookup: null,
    latestRun: null,
    ...overrides,
  };
}
export const emptyShipments = {
  items: [],
  page: 1,
  pageSize: 25,
  total: 0,
  tabCounts: { all: 0, active: 0, paused: 0, delivered: 0, attention: 0 },
};
