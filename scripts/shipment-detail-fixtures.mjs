/** Read-model fixtures in the harness's disposable database, never developer data or carrier I/O. */
export async function seedShipmentDetailFixtures(source) {
  await source.transaction(async (manager) => {
    const [carrier] = await manager.query("SELECT id FROM carriers WHERE code = 'ups'");
    for (const status of ['running', 'succeeded', 'partially_succeeded', 'failed', 'cancelled']) {
      const [shipment] = await manager.query(
        'INSERT INTO shipments (carrier_id, tracking_reference) VALUES ($1, $2) RETURNING id',
        [carrier.id, `fe-detail-${status}`],
      );
      const [run] = await manager.query(
        `INSERT INTO tracking_runs (carrier_id, trigger, status, started_at, completed_at)
        VALUES ($1, 'scheduled', $2::tracking_run_status, now(), CASE WHEN $2::tracking_run_status = 'running' THEN NULL ELSE now() END) RETURNING id`,
        [carrier.id, status],
      );
      const outcome =
        status === 'running'
          ? 'pending'
          : status === 'succeeded'
            ? 'not_found'
            : status === 'cancelled'
              ? 'skipped'
              : 'failed';
      await manager.query(
        `INSERT INTO tracking_attempts (tracking_run_id, shipment_id, outcome, retryable, reason_code, completed_at)
        VALUES ($1, $2, $3::tracking_attempt_outcome, $4, $5, CASE WHEN $3::tracking_attempt_outcome = 'pending' THEN NULL ELSE now() END)`,
        [
          run.id,
          shipment.id,
          outcome,
          outcome === 'failed' ? true : null,
          outcome === 'failed' ? 'TIMEOUT' : outcome === 'skipped' ? 'RUN_CANCELLED' : null,
        ],
      );
      if (status === 'partially_succeeded') {
        const [other] = await manager.query(
          "INSERT INTO shipments (carrier_id, tracking_reference) VALUES ($1, 'fe-detail-mixed-extra') RETURNING id",
          [carrier.id],
        );
        await manager.query(
          "INSERT INTO tracking_attempts (tracking_run_id, shipment_id, outcome, completed_at) VALUES ($1, $2, 'not_found', now())",
          [run.id, other.id],
        );
      }
    }
  });
}
