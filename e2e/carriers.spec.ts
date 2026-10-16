import { expect, type Page, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { carrierFixture } from '@test/carrier-fixture';
import { emptyShipments, shipmentFixture } from '@test/shipment-fixture';
import { installLiveFixture } from './live-fixture';

async function setup(page: Page) {
  await installLiveFixture(page);
  const state = {
    row: { ...carrierFixture },
    role: 'admin',
    reads: 0,
    readStatus: 200,
    writeStatus: 200,
    revoked: false,
    patches: [] as Record<string, unknown>[],
    hold: undefined as Promise<void> | undefined,
    readHold: undefined as Promise<void> | undefined,
  };
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: state.revoked ? 401 : 200,
      json: state.revoked ? {} : { ...accountFixture, role: state.role },
    }),
  );
  await page.route('**/api/v1/carriers**', async (route) => {
    if (route.request().method() === 'PATCH') {
      state.patches.push(route.request().postDataJSON());
      await state.hold;
      if (state.writeStatus !== 200) return route.fulfill({ status: state.writeStatus, json: {} });
      Object.assign(state.row, route.request().postDataJSON());
      return route.fulfill({ json: state.row });
    }
    state.reads++;
    await state.readHold;
    if (state.readStatus !== 200) return route.fulfill({ status: state.readStatus, json: {} });
    return route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith('/carriers') ? [state.row] : state.row,
    });
  });
  await page.route('**/api/v1/shipments/search?*', (route) =>
    route.fulfill({
      json: {
        ...emptyShipments,
        items: [shipmentFixture(1, { carrier: state.row })],
        total: 1,
        tabCounts: { all: 1, active: 1, paused: 0, delivered: 0, attention: 0 },
      },
    }),
  );
  return state;
}
async function detail(page: Page) {
  await page.goto(`/admin/carriers/${carrierFixture.externalId}`);
  await expect(page.getByRole('button', { name: 'Edit carrier', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Edit carrier', exact: true }).click();
}
async function resync(page: Page) {
  await page.evaluate(() => window.liveFixture.emit('resync'));
}

test('carrier list, read-only identity, nullable RPM, validation and both themes', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/admin/carriers');
  await page.getByRole('link', { name: 'UPS', exact: true }).click();
  await expect(page.getByLabel('UUID', { exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Code', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Edit carrier' }).click();
  await expect(page.getByLabel('Fetch mode', { exact: true })).toBeDisabled();
  await page.getByLabel('Not-found pause threshold', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect(state.patches).toHaveLength(0);
  await page.getByLabel('Not-found pause threshold', { exact: true }).fill('2');
  await page.getByLabel('Requests per minute', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit carrier' })).toBeVisible();
  expect(state.patches).toEqual([{ notFoundPauseThreshold: 2, rateLimitPerMinute: null }]);
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `/tmp/grd-carrier-${theme}-${page.viewportSize()?.width}.png`,
      fullPage: true,
    });
  }
});

test('background conflicts preserve drafts, require a choice and confirmation, and patch only changed fields', async ({
  page,
}) => {
  const state = await setup(page);
  await detail(page);
  await page.getByLabel('Name', { exact: true }).fill('My UPS name');
  state.row.name = 'Other Admin name';
  state.row.pollIntervalMinutes = 50;
  await resync(page);
  await expect(page.getByText('Latest Name: Other Admin name')).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('My UPS name');
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await page.getByRole('button', { name: 'Keep my draft', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toContainText('overwrite');
  await page.getByRole('button', { name: 'Confirm save' }).click();
  await expect(page.getByRole('button', { name: 'Edit carrier' })).toBeVisible();
  expect(state.patches).toEqual([{ name: 'My UPS name' }]);
  expect(state.row.pollIntervalMinutes).toBe(50);
  await page.getByRole('button', { name: 'Edit carrier' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Discard this');
  state.row.name = 'Newest';
  await resync(page);
  await page.getByRole('button', { name: 'Use latest settings' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Newest');
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
});

test('failed reads retain drafts and block saving until retry; dirty navigation is protected', async ({
  page,
}) => {
  const state = await setup(page);
  await detail(page);
  await page.getByLabel('Name', { exact: true }).fill('Retained draft');
  state.readStatus = 500;
  await resync(page);
  await expect(page.getByText('Your draft is retained.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Retained draft');
  state.readStatus = 200;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await page.getByRole('link', { name: 'Back to carriers' }).click();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Retained draft');
  await page.getByRole('link', { name: 'Back to carriers' }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Carriers', exact: true })).toBeVisible();
  expect(state.patches).toHaveLength(0);
});

test('disable confirmation refreshes previously cached creation and shipment eligibility', async ({
  page,
}) => {
  const state = await setup(page);
  // Warm both dependent caches in this tab before editing.
  await page.goto('/shipments');
  await expect(page.getByRole('link', { name: '0001', exact: true })).toBeVisible();
  // Use the existing shell navigation, including the mobile drawer.
  if ((page.viewportSize()?.width ?? 1280) < 900)
    await page.getByRole('button', { name: /open navigation/i }).click();
  await page.getByRole('link', { name: 'Carriers', exact: true }).click();
  await page.getByRole('link', { name: 'UPS', exact: true }).click();
  await page.getByRole('button', { name: 'Edit carrier' }).click();
  await page.getByLabel('Active', { exact: true }).selectOption('false');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toContainText('Existing shipments remain visible');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.patches).toHaveLength(0);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('button', { name: 'Confirm save' }).click();
  await expect(page.getByRole('button', { name: 'Edit carrier' })).toBeVisible();
  expect(state.patches).toEqual([{ isActive: false }]);
  if ((page.viewportSize()?.width ?? 1280) < 900)
    await page.getByRole('button', { name: /open navigation/i }).click();
  await page.getByRole('link', { name: 'Shipments', exact: true }).click();
  await expect(
    page.getByText('No enabled carriers are available.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '0001', exact: true })).toBeVisible();
  await expect(page.getByText(/Carrier disabled/).first()).toBeVisible();
});

test('focus and reconnect refresh settings without replacing dirty input; browser mode is available for FFE', async ({
  page,
}) => {
  await page.clock.install();
  const state = await setup(page);
  state.row.code = 'ffe';
  await detail(page);
  const reads = state.reads;
  state.row.name = 'FFE newest';
  let releaseRead = () => {};
  state.readHold = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  await page.clock.runFor(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.runFor(200);
  await expect.poll(() => state.reads).toBeGreaterThan(reads);
  await page.getByLabel('Fetch mode', { exact: true }).selectOption('browser');
  releaseRead();
  state.readHold = undefined;
  await expect(page.getByText('Latest Name: FFE newest')).toBeVisible();
  await expect(page.getByLabel('Fetch mode', { exact: true })).toHaveValue('browser');
  await page.getByRole('button', { name: 'Use latest settings' }).click();
  state.row.pollIntervalMinutes = 60;
  await page.evaluate(() => {
    window.liveFixture.disconnect();
    window.liveFixture.emit('resync');
  });
  await page.clock.runFor(200);
  await expect(page.getByLabel('Polling interval (minutes)', { exact: true })).toHaveValue('60');
});

test('failed saves and pending writes preserve input and prevent duplicate submissions', async ({
  page,
}) => {
  const state = await setup(page);
  await detail(page);
  await page.getByLabel('Name', { exact: true }).fill('Save this');
  state.writeStatus = 500;
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/could not complete/)).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Save this');
  state.writeStatus = 200;
  let release = () => {};
  state.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await expect(page.getByLabel('Name', { exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole('button', { name: 'Edit carrier' })).toBeVisible();
  expect(state.patches).toHaveLength(2);
});

test('Staff direct URLs, invalid IDs, missing carriers and revoked sessions are guarded', async ({
  page,
}) => {
  const state = await setup(page);
  state.role = 'staff';
  for (const path of ['/admin/carriers', `/admin/carriers/${carrierFixture.externalId}`]) {
    await page.goto(path);
    await expect(page.getByText('You do not have permission to view this page.')).toBeVisible();
  }
  expect(state.reads).toBe(0);
  state.role = 'admin';
  await page.goto('/admin/carriers/bad-id');
  expect(state.reads).toBe(0);
  state.readStatus = 404;
  await page.goto(`/admin/carriers/${carrierFixture.externalId}`);
  await expect(page.getByText(/requested record is not available/)).toBeVisible();
  state.readStatus = 200;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByRole('button', { name: 'Edit carrier' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Private draft');
  state.revoked = true;
  state.readStatus = 401;
  await resync(page);
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
});
