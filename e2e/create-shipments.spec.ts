import { expect, type Page, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { emptyShipments, shipmentFixture } from '@test/shipment-fixture';
import { installLiveFixture } from './live-fixture';

const carrier = shipmentFixture().carrier;
const addForm = (page: Page) => page.getByRole('form', { name: 'Add shipment', exact: true });

async function setup(page: Page) {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  await page.route('**/api/v1/carriers', (route) => route.fulfill({ json: [carrier] }));
  await page.route('**/api/v1/shipments/search?*', (route) =>
    route.fulfill({ json: emptyShipments }),
  );
  await page.goto('/shipments');
}

test('adds one shipment inline, sends the single-item contract and keeps the carrier selected', async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  await page.route('**/api/v1/shipments', async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({
      carrierExternalId: carrier.externalId,
      trackingReference: '001aB',
      notes: null,
      salesRepExternalId: null,
      followUpOn: null,
    });
    await route.fulfill({
      status: 201,
      json: { outcome: 'created', shipment: shipmentFixture() },
    });
  });
  await addForm(page).getByLabel('Carrier', { exact: true }).selectOption(carrier.externalId);
  await addForm(page).getByLabel('Tracking reference', { exact: true }).fill(' 001aB ');
  await addForm(page).getByLabel('Notes (optional)', { exact: true }).fill('   ');
  await page
    .getByRole('button', { name: 'Add shipment', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(page.getByRole('alert').filter({ hasText: 'Shipment added.' })).toBeVisible();
  await expect(page).toHaveURL(/\/shipments(?:\?|$)/);
  await expect(addForm(page).getByLabel('Carrier', { exact: true })).toHaveValue(
    carrier.externalId,
  );
  await expect(addForm(page).getByLabel('Tracking reference', { exact: true })).toHaveValue('');
  await expect(addForm(page).getByLabel('Notes (optional)', { exact: true })).toHaveValue('');
  expect(calls).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('warns immediately when the submitted shipment already exists', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/shipments', (route) =>
    route.fulfill({
      status: 200,
      json: {
        outcome: 'existing',
        shipment: shipmentFixture(2, { notes: 'Original notes', monitoringStatus: 'paused' }),
      },
    }),
  );
  await addForm(page).getByLabel('Carrier', { exact: true }).selectOption(carrier.externalId);
  await addForm(page).getByLabel('Tracking reference', { exact: true }).fill('already-saved');
  await addForm(page).getByLabel('Notes (optional)', { exact: true }).fill('Do not overwrite');
  await page.getByRole('button', { name: 'Add shipment', exact: true }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Shipment already exists. Existing notes and status were retained.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'View existing monitoring', exact: true }),
  ).toBeVisible();
});

test('keeps the draft on validation, connectivity, and carrier-race failures', async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route('**/api/v1/shipments', (route) => {
    calls++;
    return route.fulfill({
      status: 400,
      json: {
        code: 'shipment_validation_failed',
        details: [{ field: 'carrierExternalId', message: 'private database text' }],
      },
    });
  });
  await page.getByRole('button', { name: 'Add shipment', exact: true }).click();
  await expect(page.getByText('Enter a tracking reference.')).toBeVisible();
  expect(calls).toBe(0);
  await addForm(page).getByLabel('Carrier', { exact: true }).selectOption(carrier.externalId);
  await addForm(page).getByLabel('Tracking reference', { exact: true }).fill('keep-me');
  await page.getByRole('button', { name: 'Add shipment', exact: true }).click();
  await expect(page.getByText('Carrier is unavailable. Choose an enabled carrier.')).toBeVisible();
  await expect(page.getByText('private database text')).toHaveCount(0);
  await expect(addForm(page).getByLabel('Tracking reference', { exact: true })).toHaveValue(
    'keep-me',
  );
  await page.route('**/api/v1/shipments', (route) => route.abort());
  await page.getByRole('button', { name: 'Add shipment', exact: true }).click();
  await expect(
    page.getByText('Cannot reach the server. Check your connection and try again.'),
  ).toBeVisible();
  await expect(addForm(page).getByLabel('Tracking reference', { exact: true })).toHaveValue(
    'keep-me',
  );
});
