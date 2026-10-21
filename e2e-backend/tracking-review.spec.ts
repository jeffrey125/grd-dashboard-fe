import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const apiPort = process.env.FE_TEST_API_PORT ?? '3000';
const api = `http://localhost:${apiPort}/api/v1`;

/** Commit only into the uniquely labeled disposable harness DB. No carrier I/O. */
function changeTracking(shipmentId: string, attention = false) {
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
      INSERT INTO shipment_tracking_snapshots (shipment_id, carrier_status)
      SELECT id, 'FE-V1-011 committed tracking change' FROM shipments WHERE external_id = '${shipmentId}';
      UPDATE shipments SET current_tracking_snapshot_id =
        (SELECT snapshot.id FROM shipment_tracking_snapshots snapshot WHERE snapshot.shipment_id = shipments.id ORDER BY snapshot.id DESC LIMIT 1)
        ${attention ? ", monitoring_status = 'paused', monitoring_reason = 'not_found_threshold'" : ''}
      WHERE external_id = '${shipmentId}';
      COMMIT;`,
      stdio: ['pipe', 'ignore', 'pipe'],
    },
  );
}

for (const origin of ['http://localhost:4175', 'http://localhost:4176']) {
  test(`notes-only silence and committed tracking alerts through ${origin}`, async ({
    page,
    context,
  }) => {
    if (origin.endsWith('4176')) await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${origin}/shipments`);
    await page
      .getByLabel('Email', { exact: true })
      .fill(`frontend-tracking-${origin.slice(-4)}-staff@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('shipments fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shipments', exact: true })).toBeVisible();
    await page.goto(`${origin}/shipments?tab=all`);
    const headers = { Origin: origin };
    const carriers = await (await context.request.get(`${api}/carriers`)).json();
    const trackingReference = `fe-review-${origin.slice(-4)}-${Date.now()}`;
    const created = await context.request.post(`${api}/shipments`, {
      headers,
      data: { carrierExternalId: carriers[0].externalId, trackingReference },
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).shipment.externalId as string;
    await page.getByLabel('Search reference or notes').fill(trackingReference);
    await expect(page.getByRole('link', { name: trackingReference, exact: true })).toBeVisible();
    expect(
      (
        await context.request.patch(`${api}/shipments/${id}`, {
          headers,
          data: { notes: 'FE-V1-011 notes-only update' },
        })
      ).status(),
    ).toBe(200);
    await page.waitForTimeout(2500);
    await expect(page.locator('.MuiSnackbar-root')).toHaveCount(0);
    await expect(page.getByText(/^(● )?Updated$/)).toHaveCount(0);
    changeTracking(id);
    await expect(
      page.getByText('1 shipment updated. Updates may be outside this view.'),
    ).toBeVisible();
    await expect(page.getByText(/^(● )?Updated$/)).toHaveCount(1);
    await page.reload();
    await expect(page.getByText(/^(● )?Updated$/)).toHaveCount(1);
    const result = origin.endsWith('4175')
      ? page.getByRole('row').filter({ hasText: trackingReference })
      : page.getByRole('article', { name: `Shipment ${trackingReference}` });
    await result.getByText('FE-V1-011 committed tracking change', { exact: true }).click();
    await expect(page).toHaveURL(/\/shipments\?/);
    await expect(page.getByText(/^(● )?Updated$/)).toHaveCount(1);
    await result.getByRole('link', { name: trackingReference, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/shipments/${id}`));
    await expect(
      page.getByText('FE-V1-011 committed tracking change', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to results' }).click();
    await expect(page.getByText(/^(● )?Updated$/)).toHaveCount(0);
    changeTracking(id, true);
    await expect(page.getByText(/^(● )?Needs attention$/)).toHaveCount(1);
    await result.getByRole('link', { name: trackingReference, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/shipments/${id}`));
    await expect(
      page.getByText('FE-V1-011 committed tracking change', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to results' }).click();
    await expect(page.getByText(/^(● )?Needs attention$/)).toHaveCount(0);
    expect((await context.request.delete(`${api}/shipments/${id}`, { headers })).status()).toBe(
      204,
    );
  });
}
