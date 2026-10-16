import { expect, type Page, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { emptyOverview, overviewFixture } from '@test/overview-fixture';
import { installLiveFixture } from './live-fixture';

test.use({ timezoneId: 'America/Los_Angeles' });
async function setup(page: Page) {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  const state = {
    data: overviewFixture(),
    failure: false,
    reads: 0,
    hold: undefined as Promise<void> | undefined,
  };
  await page.route('**/api/v1/dashboard/overview', async (route) => {
    state.reads++;
    await state.hold;
    await route.fulfill({
      status: state.failure ? 500 : 200,
      json: state.failure ? {} : state.data,
    });
  });
  const row = state.data.attention.items[0];
  if (!row) throw new Error('Missing overview fixture');
  await page.route(/\/api\/v1\/shipments\/[0-9a-f-]+$/, (route) => route.fulfill({ json: row }));
  await page.route('**/api/v1/shipments/*/history?*', (route) =>
    route.fulfill({
      json: {
        items: [row.currentTracking],
        page: 1,
        pageSize: 25,
        total: 1,
      },
    }),
  );
  return Object.assign(state, { row });
}

test('server counts, problem-first layout, keyboard drill-downs, return navigation and both themes', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'All shipments: 1200' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Paused:/ })).toHaveCount(0);
  const attention = page.getByRole('region', { name: 'Needs attention', exact: true });
  await expect(attention).toContainText('Latest tracking lookup failed');
  await expect(attention).toContainText('Monitoring paused after repeated not-found results');
  await expect(attention).toContainText('Last known carrier status: In transit');
  const upcoming = page.getByRole('region', { name: 'Upcoming deliveries' });
  await expect(upcoming).toContainText('Oct 20, 2026');
  await expect(upcoming).toContainText('Showing 1 of 1');
  const upcomingLink = new URL(
    (await upcoming
      .getByRole('link', { name: 'View all upcoming deliveries' })
      .getAttribute('href')) ?? '',
    'http://fixture',
  );
  expect(Object.fromEntries(upcomingLink.searchParams)).toMatchObject({
    tab: 'all',
    estimatedDeliveryFrom: '2026-10-16',
    estimatedDeliveryTo: '2026-10-22',
    undeliveredOnly: 'true',
    sortBy: 'estimatedDeliveryOn',
    sortDirection: 'asc',
  });
  await expect(page.getByRole('region', { name: 'Recent tracking changes' })).toHaveCount(0);
  await expect(page.getByText('PRIVATE_DIAGNOSTIC')).toHaveCount(0);
  for (const [name, tab] of [
    ['All shipments', 'all'],
    ['Active', 'active'],
    ['Delivered', 'delivered'],
    ['Needs attention', 'attention'],
  ]) {
    const href = await page
      .getByRole('link', { name: new RegExp(`^${name}:`) })
      .getAttribute('href');
    expect(new URL(href ?? '', 'http://fixture').searchParams.get('tab')).toBe(tab);
  }
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-grd-color-scheme', theme);
    const a = await attention.boundingBox();
    if (!a) throw new Error('Missing Needs attention panel');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `/tmp/grd-overview-${theme}-${page.viewportSize()?.width}.png`,
      fullPage: true,
    });
  }
  await attention.getByRole('link', { name: state.row.trackingReference, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: state.row.trackingReference })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Overview' }).click();
});

test('loading, initial error, retry and genuine empty data stay distinct', async ({ page }) => {
  const state = await setup(page);
  let release = () => {};
  state.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  state.failure = true;
  await page.goto('/');
  await expect(page.getByText('Loading overview…')).toBeVisible();
  await expect(page.getByRole('link', { name: /^All shipments:/ })).toHaveCount(0);
  release();
  await expect(page.getByText(/Overview could not be loaded/)).toBeVisible();
  await expect(page.getByRole('link', { name: /^All shipments:/ })).toHaveCount(0);
  state.failure = false;
  state.data = structuredClone(emptyOverview);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('link', { name: 'All shipments: 0' })).toBeVisible();
  await expect(page.getByText('No shipments need attention.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Upcoming deliveries' })).toContainText(
    'No upcoming deliveries',
  );
  await expect(page.getByRole('region', { name: 'Recent tracking changes' })).toHaveCount(0);
});

test('minute polling retains stale data and its warning until a successful recovery', async ({
  page,
}) => {
  await page.clock.install();
  const state = await setup(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'All shipments: 1200' })).toBeVisible();
  state.failure = true;
  await page.clock.runFor(60_100);
  await expect(page.getByText(/Overview may be stale/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'All shipments: 1200' })).toBeVisible();
  let release = () => {};
  state.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  state.failure = false;
  state.data.counts.all = 1201;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeDisabled();
  await expect(page.getByText(/Overview may be stale/)).toBeVisible();
  release();
  await expect(page.getByRole('link', { name: 'All shipments: 1201' })).toBeVisible();
  await expect(page.getByText(/Overview may be stale/)).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const reads = state.reads;
  await page.clock.runFor(120_000);
  expect(state.reads).toBe(reads);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(150);
  await expect.poll(() => state.reads).toBeGreaterThan(reads);
});

test('live tracking refreshes quietly without losing the homepage', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'All shipments: 1200' })).toBeVisible();
  state.data.counts.all = 1202;
  await page.evaluate(
    (row) =>
      window.liveFixture.emit('tracking.changed', {
        externalId: row.externalId,
        snapshotExternalId: row.currentTracking?.externalId,
        observedAt: row.currentTracking?.observedAt,
      }),
    state.row,
  );
  await expect(page.getByRole('link', { name: 'All shipments: 1202' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page).toHaveURL('/');
});
