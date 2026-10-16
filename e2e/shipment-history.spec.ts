import type { TrackingSnapshot } from '@features/shipments/schemas';
import { expect, type Page, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { shipmentFixture } from '@test/shipment-fixture';
import { installLiveFixture } from './live-fixture';

test.use({ timezoneId: 'America/Los_Angeles' });
function snapshot(index: number): TrackingSnapshot {
  return {
    externalId: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    observedAt: '2026-10-16T14:00:00.000Z',
    carrierStatus: `Status ${index}`,
    carrierStatusDetail: index % 2 ? null : 'Departed facility',
    pickedUpOn: '2026-10-14',
    estimatedDeliveryOn: '2026-10-20',
    deliveredOn: null,
  };
}
async function setup(page: Page, count = 26) {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  const state = {
    items: Array.from({ length: count }, (_, i) => snapshot(count - i)),
    row: shipmentFixture(1, { notes: 'Saved note' }),
    failure: false,
    missing: false,
    reads: 0,
    hold: undefined as Promise<void> | undefined,
  };
  await page.route(/\/api\/v1\/shipments\/[0-9a-f-]+$/, (route) =>
    route.fulfill({ status: state.missing ? 404 : 200, json: state.missing ? {} : state.row }),
  );
  await page.route('**/api/v1/shipments/*/history?*', async (route) => {
    state.reads++;
    const params = new URL(route.request().url()).searchParams;
    const current = Number(params.get('page'));
    const pageSize = Number(params.get('pageSize'));
    const response = {
      items: state.items.slice((current - 1) * pageSize, current * pageSize),
      total: state.items.length,
      page: current,
      pageSize,
    };
    await state.hold;
    await route.fulfill({
      status: state.missing ? 404 : state.failure ? 500 : 200,
      json: state.missing || state.failure ? {} : response,
    });
  });
  return state;
}
async function emit(page: Page, id: string) {
  await page.evaluate(
    (externalId) => window.liveFixture.emit('shipment.changed', { externalId }),
    id,
  );
}
test('direct history links, truthful differences, page boundaries, URL navigation and responsive themes', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(`/shipments/${state.row.externalId}?tab=history`);
  await expect(page.getByRole('article')).toHaveCount(25);
  await expect(page.getByText('Changed carrier status: Status 25 → Status 26')).toBeVisible();
  await expect(
    page.getByRole('article').first().getByText('2026-10-20', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('article').first().getByRole('heading')).toContainText('10:00 AM');
  await expect(
    page.getByText('Earlier observation is on another page;', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('article', { name: /^Initial observation/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('article', { name: /^Initial observation/ })).toHaveCount(1);
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit notes' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Observations per page' }).click();
  await page.getByRole('option', { name: '50', exact: true }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByRole('article')).toHaveCount(26);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `/tmp/grd-history-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.getByRole('tab', { name: 'History', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit notes' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('article')).toHaveCount(26);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `/tmp/grd-history-dark-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `/tmp/grd-history-dark-viewport-${page.viewportSize()?.width}.png`,
  });
});
test('dirty notes require discard on tab change and never reappear after confirmation', async ({
  page,
}) => {
  const state = await setup(page, 1);
  await page.goto(`/shipments/${state.row.externalId}`);
  expect(state.reads).toBe(0);
  await page.getByRole('button', { name: 'Edit notes' }).click();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Draft');
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('Draft');
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Notes', exact: true })).toContainText(
    'Saved note',
  );
  await page.getByRole('button', { name: 'Edit notes' }).click();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('Saved note');
});
test('live event during an older request causes a trailing refresh while preserving page and scroll', async ({
  page,
}) => {
  const state = await setup(page, 51);
  let release = () => {};
  state.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.goto(`/shipments/${state.row.externalId}?tab=history&page=2`);
  await expect.poll(() => state.reads).toBe(1);
  state.items.unshift(snapshot(52));
  await emit(page, state.row.externalId);
  state.hold = undefined;
  release();
  await expect(page.getByRole('article').first()).toContainText('Status 27');
  await expect.poll(() => state.reads).toBe(2);
  await expect(page).toHaveURL(/page=2/);
  await page.evaluate(() => scrollTo(0, 400));
  state.items.unshift(snapshot(53));
  await emit(page, state.row.externalId);
  await expect(page.getByText('History updated.', { exact: false })).toBeVisible();
  await expect(page.getByRole('article').first()).toContainText('Status 28');
  expect(await page.evaluate(() => scrollY)).toBe(400);
  state.failure = true;
  await emit(page, state.row.externalId);
  await expect(
    page.getByText('Showing previously loaded history.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(25);
  state.failure = false;
  state.missing = true;
  await emit(page, state.row.externalId);
  await expect(page.getByRole('heading', { name: 'Shipment unavailable' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
});
test('empty history, failed reads with retry, invalid URL recovery and page clamping stay distinct', async ({
  page,
}) => {
  const state = await setup(page, 0);
  await page.goto(`/shipments/${state.row.externalId}?tab=history`);
  await expect(page.getByText('No tracking observations recorded yet.')).toBeVisible();
  state.items = [snapshot(1)];
  state.failure = true;
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByText('No tracking observations recorded yet.')).toHaveCount(0);
  state.failure = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.goto(`/shipments/${state.row.externalId}?tab=history&page=999`);
  await expect(page).toHaveURL(/page=1(?:&|$)/);
  await expect(page.getByRole('article')).toHaveCount(1);
  const reads = state.reads;
  await page.goto(`/shipments/${state.row.externalId}?tab=history&page=-1`);
  await expect(page.getByText('Invalid detail URL:', { exact: false })).toBeVisible();
  expect(state.reads).toBe(reads);
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.getByRole('button', { name: 'Edit notes' })).toBeVisible();
});
