/** Real tracking finalization in the disposable harness DB, with no worker/carrier calls. */
export async function seedShipmentHistoryFixtures(source, tracking) {
  const [carrier] = await source.query("SELECT id, external_id FROM carriers WHERE code = 'ups'");
  const initial = {
    carrierStatus: null,
    carrierStatusDetail: null,
    pickedUpOn: '2026-10-14',
    estimatedDeliveryOn: null,
    deliveredOn: null,
  };
  for (const scenario of [
    'empty',
    'initial',
    'changed',
    'unchanged',
    'failed-later',
    'multi-page',
  ]) {
    const [shipment] = await source.query(
      'INSERT INTO shipments (carrier_id, tracking_reference) VALUES ($1, $2) RETURNING id, external_id',
      [carrier.id, `fe-history-${scenario}`],
    );
    if (scenario === 'empty') continue;
    if (scenario === 'multi-page') {
      await source.query(
        `INSERT INTO shipment_tracking_snapshots
        (shipment_id, carrier_status, picked_up_on, estimated_delivery_on, observed_at)
        SELECT $1, 'Observation ' || n, '2026-10-14', '2026-10-20', '2026-10-16T14:00:00Z'
        FROM generate_series(1, 26) n`,
        [shipment.id],
      );
      await source.query(
        `UPDATE shipments SET current_tracking_snapshot_id =
        (SELECT id FROM shipment_tracking_snapshots WHERE shipment_id = $1 ORDER BY id DESC LIMIT 1)
        WHERE id = $1`,
        [shipment.id],
      );
      continue;
    }
    const finalize = async (snapshot, failed = false) => {
      const run = await tracking.createRun({
        carrierExternalId: carrier.external_id,
        shipmentExternalIds: [shipment.external_id],
        trigger: 'scheduled',
        requestedById: null,
      });
      const { targets } = await tracking.startRun(run.externalId);
      const args = {
        runExternalId: run.externalId,
        shipmentExternalId: shipment.external_id,
        expectedLockVersion: targets[0].expectedLockVersion,
        effectiveIntervalMinutes: 30,
        sourceData: null,
      };
      if (failed)
        await tracking.finalizeFailed({
          ...args,
          retryable: true,
          reasonCode: 'FIXTURE_TIMEOUT',
          message: 'Private fixture diagnostic',
        });
      else await tracking.finalizeFound({ ...args, snapshot });
    };
    await finalize(initial);
    if (scenario === 'unchanged') await finalize(initial);
    if (scenario === 'changed' || scenario === 'failed-later')
      await finalize({
        ...initial,
        carrierStatus: 'In transit',
        carrierStatusDetail: 'Departed facility',
        estimatedDeliveryOn: '2026-10-20',
      });
    if (scenario === 'failed-later') await finalize(null, true);
  }
}
