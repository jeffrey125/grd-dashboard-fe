import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const apiPort = process.env.FE_TEST_API_PORT ?? '3000';
const api = `http://localhost:${apiPort}/api/v1`;

/** Commit only into the uniquely labeled disposable harness DB. No carrier I/O. */
function deliver(shipmentId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(shipmentId))
    throw new Error('Invalid test shipment identity');
  const container = readFileSync(`/tmp/grd-fe-auth-${apiPort}.container`, 'utf8').trim();

  if (!/^[0-9a-f]{64}$/.test(container)) throw new Error('Invalid isolated test database identity');

  const label = execFileSync(
    'docker',
    ['inspect', '--format', '{{index .Config.Labels "grd.fe.test.api-port"}}', container],
    { encoding: 'utf8' },
  ).trim();

  if (label !== apiPort) throw new Error('Unexpected isolated test database label');
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'fe_auth_test',
      '-d',
      'fe_auth_test',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input: `BEGIN;
      INSERT INTO shipment_tracking_snapshots (shipment_id, carrier_status, delivered_on)
      SELECT id, 'Delivered', (clock_timestamp() AT TIME ZONE 'America/New_York')::date FROM shipments WHERE external_id = '${shipmentId}';
      UPDATE shipments SET current_tracking_snapshot_id =
        (SELECT snapshot.id FROM shipment_tracking_snapshots snapshot WHERE snapshot.shipment_id = shipments.id ORDER BY snapshot.id DESC LIMIT 1),
        monitoring_status = 'completed', monitoring_reason = 'delivered', next_check_at = NULL
      WHERE external_id = '${shipmentId}';
      COMMIT;`,
      stdio: ['pipe', 'ignore', 'pipe'],
    },
  );
}

for (const mobile of [false, true]) {
  test(`staff reopens a delivered shipment with a future follow-up (${mobile ? 'mobile' : 'desktop'})`, async ({
    page,
    context,
  }) => {
    const origin = mobile ? 'http://localhost:4176' : 'http://localhost:4175';
    if (mobile) await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${origin}/shipments`);
    await page
      .getByLabel('Email', { exact: true })
      .fill(`frontend-tracking-${origin.slice(-4)}-staff@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('shipments fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shipments', exact: true })).toBeVisible();
    const headers = { Origin: origin };
    const carriers = await (await context.request.get(`${api}/carriers`)).json();
    const reference = `monitor-again-${mobile}-${Date.now()}`;
    const created = await context.request.post(`${api}/shipments`, {
      headers,
      data: { carrierExternalId: carriers[0].externalId, trackingReference: reference },
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).shipment.externalId as string;
    deliver(id);
    await page.goto(`${origin}/shipments?tab=delivered&q=${encodeURIComponent(reference)}`);
    await expect(page.getByRole('link', { name: reference, exact: true })).toBeVisible();
    if (!mobile) await page.getByRole('button', { name: `Actions for ${reference}` }).click();
    const actions = mobile
      ? page.getByRole('article', { name: `Shipment ${reference}`, exact: true })
      : page;
    await actions
      .getByRole(mobile ? 'button' : 'menuitem', { name: 'Monitor again', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Monitor again' });
    await expect(dialog).toBeVisible();
    const date = await dialog.getByLabel('Follow-up date').inputValue();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await dialog.getByRole('button', { name: 'Start monitoring' }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(
        async () =>
          (await (await context.request.get(`${api}/shipments/${id}`)).json()).monitoringStatus,
      )
      .toBe('active');
    await page.goto(`${origin}/shipments?tab=active&q=${encodeURIComponent(reference)}`);
    await expect(page.getByRole('link', { name: reference, exact: true })).toBeVisible();
    await page.getByRole('link', { name: reference, exact: true }).click();
    await expect(
      page.getByText(`Delivered; checks continue until the start of ${date} in New York time.`),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause monitoring', exact: true })).toBeVisible();
    // A true staff draft survives an external update; a saved/pristine form follows it.
    await page.getByLabel('Date to Follow Up', { exact: true }).fill('2099-12-31');
    expect(
      (
        await context.request.patch(`${api}/shipments/${id}`, {
          headers,
          data: { followUpOn: null },
        })
      ).status(),
    ).toBe(200);
    await expect(page.getByRole('button', { name: 'Monitor again', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Date to Follow Up', { exact: true })).toHaveValue('2099-12-31');
    await page.getByRole('button', { name: 'Save assignment', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save assignment', exact: true })).toBeDisabled();
    await expect
      .poll(
        async () =>
          (await (await context.request.get(`${api}/shipments/${id}`)).json()).monitoringStatus,
      )
      .toBe('active');
    const stopped = await context.request.patch(`${api}/shipments/${id}`, {
      headers,
      data: { followUpOn: null },
    });
    expect(stopped.status()).toBe(200);
    expect((await stopped.json()).monitoringStatus).toBe('completed');
    await expect(page.getByLabel('Date to Follow Up', { exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Monitor again', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Monitor again', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Start monitoring' }).click();
    await expect
      .poll(
        async () =>
          (await (await context.request.get(`${api}/shipments/${id}`)).json()).monitoringStatus,
      )
      .toBe('active');
    expect((await context.request.delete(`${api}/shipments/${id}`, { headers })).status()).toBe(
      204,
    );
  });
}
