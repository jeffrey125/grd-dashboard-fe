import { shipmentFixture } from '@test/shipment-fixture';
import { expect, it } from 'vitest';
import { actionRules } from './actions';

it('distinguishes manual pause, threshold pause, delivery and disabled carriers', () => {
  expect(actionRules(shipmentFixture())).toEqual({
    refresh: undefined,
    pause: true,
    resume: false,
  });
  expect(
    actionRules(shipmentFixture(1, { monitoringStatus: 'paused', monitoringReason: 'manual' })),
  ).toMatchObject({ refresh: expect.any(String), pause: false, resume: true });
  expect(
    actionRules(
      shipmentFixture(1, { monitoringStatus: 'paused', monitoringReason: 'not_found_threshold' }),
    ),
  ).toEqual({ refresh: undefined, pause: false, resume: false });
  expect(
    actionRules(
      shipmentFixture(1, { monitoringStatus: 'completed', monitoringReason: 'delivered' }),
    ),
  ).toMatchObject({ refresh: expect.any(String), pause: false, resume: false });
  const row = shipmentFixture();
  row.carrier.isActive = false;
  expect(actionRules(row)).toMatchObject({ refresh: 'Carrier is disabled.', pause: true });
});

it('permits active delivered checks only before the follow-up date', () => {
  const row = shipmentFixture();
  row.currentTracking = {
    externalId: '00000000-0000-4000-8000-000000000002',
    carrierStatus: 'Delivered',
    carrierStatusDetail: null,
    pickedUpOn: null,
    estimatedDeliveryOn: null,
    deliveredOn: '2026-01-01',
    observedAt: '2026-01-01T12:00:00.000Z',
  };
  row.followUpOn = '9999-12-31';
  expect(actionRules(row).refresh).toBeUndefined();
  row.followUpOn = null;
  expect(actionRules(row).refresh).toContain('future follow-up');
  row.monitoringStatus = 'paused';
  row.monitoringReason = 'manual';
  expect(actionRules(row).resume).toBe(false);
});
