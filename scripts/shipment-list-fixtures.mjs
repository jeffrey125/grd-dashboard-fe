/** Deterministic data only in the auth harness's disposable database; no carrier I/O. */
export async function seedShipmentListFixtures(source) {
  await source.transaction(async (manager) => {
    const [carrier] = await manager.query("SELECT id FROM carriers WHERE code = 'ups'");
    await manager.query(
      `INSERT INTO shipments (carrier_id, tracking_reference, notes, monitoring_status, monitoring_reason, created_at)
      SELECT $1, 'fe-list-' || lpad(n::text, 4, '0'), CASE
        WHEN n = 800 THEN 'Priority customer order with multiple receiving instructions. Call the warehouse thirty minutes before arrival, use the north loading entrance, and ask for the afternoon receiving lead. Keep the shipment together and report any damaged packaging before unloading.'
        WHEN n = 799 THEN 'This is a deliberately long note for responsive layout review. The delivery contains temperature-sensitive materials, so it must remain covered during unloading and should not be left on the dock. Receiving hours are 8:00 AM to 4:30 PM Eastern Time.'
        WHEN n = 798 THEN 'Appointment required. Driver should bring the bill of lading, confirm the purchase-order number at the security desk, and wait for a dock assignment. If the appointment changes, notify the operations team before proceeding to the destination.'
        WHEN n = 1 THEN 'unique-off-page-note'
        ELSE NULL
      END,
        (CASE WHEN n <= 800 THEN 'active' WHEN n <= 950 THEN 'paused' ELSE 'completed' END)::shipment_monitoring_status,
        (CASE WHEN n <= 800 THEN NULL WHEN n <= 900 THEN 'manual' WHEN n <= 950 THEN 'not_found_threshold' ELSE 'delivered' END)::shipment_monitoring_reason,
        '2026-10-16T14:00:00Z'::timestamptz
      FROM generate_series(1, 1000) n`,
      [carrier.id],
    );
    await manager.query(`INSERT INTO shipment_tracking_snapshots (shipment_id, carrier_status, estimated_delivery_on, delivered_on)
      SELECT id, CASE WHEN monitoring_status = 'completed' THEN 'Delivered' ELSE 'In transit' END, '2026-10-20',
        CASE WHEN monitoring_status = 'completed' THEN '2026-10-20'::date ELSE NULL END
      FROM shipments WHERE tracking_reference LIKE 'fe-list-%'`);
    await manager.query(`UPDATE shipments s SET current_tracking_snapshot_id = snapshot.id FROM shipment_tracking_snapshots snapshot
      WHERE snapshot.shipment_id = s.id AND s.tracking_reference LIKE 'fe-list-%'`);
    const [run] = await manager.query(
      `INSERT INTO tracking_runs (carrier_id, trigger, status, started_at, completed_at)
      VALUES ($1, 'manual', 'failed', now(), now()) RETURNING id`,
      [carrier.id],
    );
    await manager.query(
      `INSERT INTO tracking_attempts (tracking_run_id, shipment_id, outcome, retryable, reason_code, completed_at)
      SELECT $1, id, 'failed', true, 'FIXTURE_FAILURE', now() FROM shipments
      WHERE tracking_reference IN ('fe-list-0001', 'fe-list-0002')`,
      [run.id],
    );
  });
}
