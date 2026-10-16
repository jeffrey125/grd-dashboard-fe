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
  const attention = page.getByRole('region', { name: 'Needs attention', exact: true });
  const upcoming = page.getByRole('region', { name: 'Upcoming deliveries', exact: true });
  const recent = page.getByRole('region', { name: 'Recent tracking changes', exact: true });
  await expect(attention).toContainText('Latest tracking lookup failed');
  await expect(attention).toContainText('Monitoring paused after repeated not-found results');
  await expect(attention).toContainText('Last known carrier status: In transit');
  await expect(upcoming).toContainText('2026-10-20');
  await expect(recent).toContainText('10:00 AM');
  await expect(page.getByText('PRIVATE_DIAGNOSTIC')).toHaveCount(0);
  for (const [name, tab] of [
    ['All shipments', 'all'],
    ['Active', 'active'],
    ['Paused', 'paused'],
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
    const u = await upcoming.boundingBox();
    const r = await recent.boundingBox();
    if (!a || !u || !r) throw new Error('Missing homepage panels');
    expect(u.y).toBeGreaterThan(a.y + a.height - 1);
    if ((page.viewportSize()?.width ?? 0) >= 900) {
      expect(Math.abs(u.y - r.y)).toBeLessThan(2);
      expect(a.width).toBeGreaterThan(u.width);
    } else expect(r.y).toBeGreaterThan(u.y);
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
  await recent.getByRole('link').click();
  await expect(page).toHaveURL(/tab=history/);
  await expect(page.getByRole('article', { name: /^Initial observation/ })).toHaveCount(1);
  await page.getByRole('link', { name: 'Back to Overview' }).click();
  await page.getByRole('link', { name: 'View all upcoming deliveries' }).click();
  const params = new URL(page.url()).searchParams;
  expect(Object.fromEntries(params)).toMatchObject({
    tab: 'all',
    undeliveredOnly: 'true',
    estimatedDeliveryFrom: '2026-10-16',
    estimatedDeliveryTo: '2026-10-22',
    sortBy: 'estimatedDeliveryOn',
    sortDirection: 'asc',
  });
  await expect(page.getByText('Undelivered only', { exact: true })).toBeVisible();
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
  await expect(page.getByText('No known deliveries in this window.')).toBeVisible();
  await expect(page.getByText('No tracking observations recorded yet.')).toBeVisible();
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

for (const [before, after, from, to] of [
  ['2026-03-08T04:59:30Z', '2026-03-08T05:00:30Z', '2026-03-08', '2026-03-14'],
  ['2026-11-01T03:59:30Z', '2026-11-01T04:00:30Z', '2026-11-01', '2026-11-07'],
] as const)
  test(`minute refresh advances the server window across New York midnight ${from}`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(before) });
    const state = await setup(page);
    state.data = {
      ...emptyOverview,
      asOf: before,
      upcomingWindow: {
        from: from === '2026-03-08' ? '2026-03-07' : '2026-10-31',
        to: from === '2026-03-08' ? '2026-03-13' : '2026-11-06',
      },
    };
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'All shipments: 0' })).toBeVisible();
    state.data = { ...emptyOverview, asOf: after, upcomingWindow: { from, to } };
    await page.clock.runFor(60_100);
    await expect(page.getByRole('region', { name: 'Upcoming deliveries' })).toContainText(
      `${from} through ${to}`,
    );
    const href = await page
      .getByRole('link', { name: 'View all upcoming deliveries' })
      .getAttribute('href');
    expect(new URL(href ?? '', 'http://fixture').searchParams.get('estimatedDeliveryFrom')).toBe(
      from,
    );
  });
