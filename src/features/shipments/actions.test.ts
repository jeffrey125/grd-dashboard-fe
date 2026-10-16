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
