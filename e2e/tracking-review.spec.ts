import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { emptyShipments, shipmentFixture } from '@test/shipment-fixture';
import { installLiveFixture } from './live-fixture';

function row(state: { rows: ReturnType<typeof shipmentFixture>[] }, index: number) {
  const result = state.rows[index];
  if (!result) throw new Error(`Missing shipment fixture ${index}`);
  return result;
}

declare global {
  interface Window {
    reviewAudio: { plays: number; deny: boolean };
    reviewVisibility: DocumentVisibilityState;
  }
}
const snapshot = (n: number) => ({
  externalId: `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  carrierStatus: `Tracking ${n}`,
  carrierStatusDetail: null,
  pickedUpOn: null,
  estimatedDeliveryOn: null,
  deliveredOn: null,
  observedAt: '2026-10-16T14:00:00.000Z',
});
async function setup(context: BrowserContext) {
  await installLiveFixture(context);
  await context.addInitScript(() => {
    window.reviewAudio = { plays: 0, deny: false };
    HTMLMediaElement.prototype.play = () => {
      window.reviewAudio.plays++;
      return window.reviewAudio.deny
        ? Promise.reject(new DOMException('Denied', 'NotAllowedError'))
        : Promise.resolve();
    };
    window.reviewVisibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { get: () => window.reviewVisibility });
  });
  const state = {
    rows: [
      shipmentFixture(1, { currentTracking: snapshot(1) }),
      shipmentFixture(2, {
        currentTracking: snapshot(2),
        monitoringStatus: 'completed',
        monitoringReason: 'delivered',
      }),
    ],
    account: { ...accountFixture },
    authenticated: true,
  };
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: state.authenticated ? 200 : 401,
      json: state.authenticated ? state.account : {},
    }),
  );
  await context.route('**/api/v1/auth/sign-out', (route) => {
    state.authenticated = false;
    return route.fulfill({ status: 204 });
  });
  await context.route('**/api/v1/auth/sign-in', (route) => {
    state.authenticated = true;
    return route.fulfill({ json: state.account });
  });
  await context.route('**/api/v1/carriers', (route) =>
    route.fulfill({ json: [shipmentFixture().carrier] }),
  );
  await context.route(/\/api\/v1\/shipments\/[0-9a-f-]+$/, (route) => {
    const row = state.rows.find((item) => route.request().url().endsWith(item.externalId));
    return route.fulfill({ status: row ? 200 : 404, json: row ?? {} });
  });
  await context.route(/\/api\/v1\/shipments\/search(?:\?|$)/, (route) => {
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
    const params =
      route.request().method() === 'POST'
        ? new URLSearchParams(body)
        : new URL(route.request().url()).searchParams;
    const priority = new Set<string>(body.priorityShipmentIds ?? []);
    const items = state.rows.filter(
      (row) => params.get('tab') === 'all' || row.monitoringStatus === 'active',
    );
    return route.fulfill({
      json: {
        ...emptyShipments,
        items: [...items]
          .sort((a, b) => Number(priority.has(b.externalId)) - Number(priority.has(a.externalId)))
          .slice((Number(params.get('page') ?? 1) - 1) * 25, Number(params.get('page') ?? 1) * 25),
        page: Number(params.get('page') ?? 1),
        total: items.length,
        tabCounts: {
          all: state.rows.length,
          active: state.rows.filter((r) => r.monitoringStatus === 'active').length,
          delivered: 1,
          paused: 0,
          attention: 0,
        },
      },
    });
  });
  return state;
}
async function emit(page: Page, id: string, revision: number) {
  await page.evaluate(
    ({ id, snapshotExternalId }) =>
      window.liveFixture.emit('tracking.changed', {
        externalId: id,
        snapshotExternalId,
        observedAt: '2026-10-16T14:00:00.000Z',
      }),
    { id, snapshotExternalId: snapshot(revision).externalId },
  );
}
const plays = (page: Page) => page.evaluate(() => window.reviewAudio.plays);
async function open(page: Page, path = '/shipments') {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Shipments', exact: true })).toBeVisible();
}
const marks = (page: Page) => page.getByText(/^(● )?Updated$/);

test('a later playback denial pauses automatic sound until an explicit retry', async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await open(page);
  await page.getByRole('switch', { name: 'Tracking sound' }).click();
  await expect(page.getByRole('switch', { name: 'Tracking sound' })).toBeChecked();
  await page.evaluate(() => {
    window.reviewAudio.deny = true;
  });
  row(state, 0).currentTracking = snapshot(3);
  await emit(page, row(state, 0).externalId, 3);
  await expect(page.getByText(/Sound was blocked/)).toBeVisible();
  expect(await plays(page)).toBe(2);
  row(state, 0).currentTracking = snapshot(4);
  await emit(page, row(state, 0).externalId, 4);
  await page.waitForTimeout(2300);
  expect(await plays(page)).toBe(2);
  await page.evaluate(() => {
    window.reviewAudio.deny = false;
  });
  await page.getByRole('button', { name: 'Enable sound in this tab' }).click();
  await expect(page.getByText(/Sound was blocked/)).toHaveCount(0);
  row(state, 0).currentTracking = snapshot(5);
  await emit(page, row(state, 0).externalId, 5);
  await expect.poll(() => plays(page)).toBe(4);
});

test('bursts include filtered-out shipments, deduplicate sound, and mark only displayed revisions across reload', async ({
  page,
  context,
}, testInfo) => {
  const state = await setup(context);
  await open(page, '/shipments?tab=active');
  await page.getByRole('switch', { name: 'Tracking sound' }).click();
  await expect.poll(() => plays(page)).toBe(1);
  row(state, 0).currentTracking = snapshot(3);
  row(state, 1).currentTracking = snapshot(4);
  await emit(page, row(state, 0).externalId, 3);
  await emit(page, row(state, 1).externalId, 4);
  await expect(
    page.getByText('2 shipments updated. Updates may be outside this view.'),
  ).toBeVisible();
  await expect.poll(() => plays(page)).toBe(2);
  await expect(marks(page)).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('review-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-grd-color-scheme', 'dark');
  await page.screenshot({ path: testInfo.outputPath('review-dark.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Mark displayed changes as seen' }).click();
  await expect(marks(page)).toHaveCount(0);
  await emit(page, row(state, 0).externalId, 3);
  await emit(page, row(state, 0).externalId, 1);
  await page.waitForTimeout(2300);
  expect(await plays(page)).toBe(2);
  await open(page, '/shipments?tab=all');
  await expect(marks(page)).toHaveCount(1);
  await page.reload();
  await expect(marks(page)).toHaveCount(1);
  await expect(page.getByRole('switch', { name: 'Tracking sound' })).toBeChecked();
  expect(await plays(page)).toBe(0);
  row(state, 0).currentTracking = snapshot(5);
  await emit(page, row(state, 0).externalId, 5);
  await expect.poll(() => plays(page)).toBe(1);
});

test('clicking anywhere reviews the row while only the Tracking Number link opens detail', async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await open(page);
  row(state, 0).currentTracking = snapshot(3);
  await emit(page, row(state, 0).externalId, 3);
  await expect(marks(page)).toHaveCount(1);

  if ((page.viewportSize()?.width ?? 0) < 900) {
    const card = page.getByRole('article', { name: 'Shipment 0001', exact: true });
    await expect(card.getByText('Tracking 3', { exact: true })).toBeVisible();
    await card.getByText('Carrier status', { exact: true }).click();
  } else await page.getByRole('gridcell', { name: 'Tracking 3', exact: true }).click();

  await expect(page).toHaveURL(/\/shipments(?:\?|$)/);
  await expect(marks(page)).toHaveCount(0);
  row(state, 0).currentTracking = snapshot(4);
  await emit(page, row(state, 0).externalId, 4);
  await expect(marks(page)).toHaveCount(1);
  if ((page.viewportSize()?.width ?? 0) < 900) {
    const card = page.getByRole('article', { name: 'Shipment 0001', exact: true });
    await expect(card.getByText('Tracking 4', { exact: true })).toBeVisible();
    await card.getByRole('link', { name: 'View details' }).click({ modifiers: ['Control'] });
  } else {
    await expect(page.getByRole('gridcell', { name: 'Tracking 4', exact: true })).toBeVisible();
    await page.locator('.MuiDataGrid-virtualScroller').evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await page.getByRole('button', { name: 'Actions for 0001', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'View details' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('.MuiDataGrid-virtualScroller').evaluate((element) => {
      element.scrollLeft = 0;
    });
  }
  await expect(marks(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/shipments(?:\?|$)/);
  await page.getByRole('link', { name: '0001', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/shipments/${row(state, 0).externalId}`));
  await page.goBack();
  await expect(marks(page)).toHaveCount(0);
});

test('the bundled M4A decodes and plays after an explicit gesture', async ({ page, context }) => {
  await installLiveFixture(context);
  await context.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  await open(page);
  await page.getByRole('switch', { name: 'Tracking sound' }).click();
  await expect(page.getByRole('switch', { name: 'Tracking sound' })).toBeChecked();
  await expect(page.getByText(/Sound could not play/)).toHaveCount(0);
});

test('two enabled background tabs produce one sound and share reviewed state', async ({
  page,
  context,
}) => {
  const state = await setup(context);
  const other = await context.newPage();
  await open(page);
  await open(other);
  await page.getByRole('switch', { name: 'Tracking sound' }).click();
  await expect(other.getByRole('switch', { name: 'Tracking sound' })).toBeChecked();
  await other.getByRole('button', { name: 'Enable sound in this tab' }).click();
  for (const tab of [page, other])
    await tab.evaluate(() => {
      window.reviewVisibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
  row(state, 0).currentTracking = snapshot(3);
  await emit(page, row(state, 0).externalId, 3);
  await emit(other, row(state, 0).externalId, 3);
  await expect.poll(async () => (await plays(page)) + (await plays(other))).toBe(3);
  await expect(marks(page)).toHaveCount(1);
  await expect(marks(other)).toHaveCount(1);
  await page.getByRole('button', { name: 'Mark displayed changes as seen' }).click();
  await expect(marks(other)).toHaveCount(0);
  await page.waitForTimeout(2300);
  expect((await plays(page)) + (await plays(other))).toBe(3);
  await other.close();
});

test('background detail retains highlights until the updated detail becomes visible', async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await open(page);
  const detail = await context.newPage();
  await detail.goto(`/shipments/${row(state, 0).externalId}`);
  await expect(detail.getByRole('heading', { name: '0001', exact: true })).toBeVisible();
  await detail.evaluate(() => {
    window.reviewVisibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  row(state, 0).currentTracking = snapshot(3);
  await emit(page, row(state, 0).externalId, 3);
  await emit(detail, row(state, 0).externalId, 3);
  await expect(detail.getByText('Tracking 3', { exact: true })).toBeVisible();
  await expect(marks(page)).toHaveCount(1);
  await expect(detail.locator('.MuiSnackbar-root')).toHaveCount(0);
  await detail.evaluate(() => {
    window.reviewVisibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(marks(page)).toHaveCount(0);
  await detail.close();
});

test('older history pages retain the mark and displaying the current history snapshot reviews it', async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await context.route('**/api/v1/shipments/*/history?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const page = Number(params.get('page'));
    const current = row(state, 0).currentTracking;
    return route.fulfill({
      json: {
        items:
          page === 1
            ? [current, ...Array.from({ length: 24 }, (_, i) => snapshot(100 + i))]
            : [snapshot(1)],
        page,
        pageSize: 25,
        total: 26,
      },
    });
  });
  await open(page);
  row(state, 0).currentTracking = snapshot(3);
  await emit(page, row(state, 0).externalId, 3);
  await expect(marks(page)).toHaveCount(1);
  await page.goto(`/shipments/${row(state, 0).externalId}?tab=history&page=2`);
  await expect(page.getByRole('article')).toHaveCount(1);
  const key = `grd.tracking-review.v1:${accountFixture.externalId}`;
  expect(
    await page.evaluate(
      ({ key, id }) => {
        const record = JSON.parse(localStorage.getItem(key) ?? '{}').records[id];
        return record.unseen || record.pending.length > 0;
      },
      { key, id: row(state, 0).externalId },
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Go to previous page' }).click();
  await expect(page.getByRole('article').first()).toContainText('Tracking 3');
  await expect
    .poll(() =>
      page.evaluate(
        ({ key, id }) => {
          const record = JSON.parse(localStorage.getItem(key) ?? '{}').records[id];
          return record.unseen || record.pending.length > 0;
        },
        { key, id: row(state, 0).externalId },
      ),
    )
    .toBe(false);
});

test('route changes discard pending alerts and overview/detail/admin/password stay quiet', async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await open(page);
  row(state, 0).currentTracking = snapshot(3);
  await emit(page, row(state, 0).externalId, 3);
  if ((page.viewportSize()?.width ?? 0) < 768)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  let revision = 4;
  for (const path of [
    '/',
    `/shipments/${row(state, 0).externalId}`,
    '/admin',
    '/change-password',
  ]) {
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => window.liveFixture.active)).toBe(1);
    row(state, 0).currentTracking = snapshot(revision);
    await emit(page, row(state, 0).externalId, revision++);
    await page.waitForTimeout(2300);
    await expect(page.locator('.MuiSnackbar-root')).toHaveCount(0);
    expect(await plays(page)).toBe(0);
  }
});

test('resync stays quiet and confirmed deletion removes persisted unseen records', async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await open(page);
  row(state, 0).currentTracking = snapshot(3);
  await emit(page, row(state, 0).externalId, 3);
  await expect(
    page.getByText('1 shipment updated. Updates may be outside this view.'),
  ).toBeVisible();
  await page.locator('.MuiSnackbar-root').getByRole('button', { name: 'Close' }).click();
  row(state, 0).currentTracking = snapshot(4);
  await page.evaluate(() => window.liveFixture.emit('resync'));
  await expect(page.getByText('Tracking 4', { exact: true })).toBeVisible();
  await page.waitForTimeout(2300);
  await expect(page.locator('.MuiSnackbar-root')).toHaveCount(0);
  const id = row(state, 0).externalId;
  state.rows.shift();
  await page.evaluate(
    (externalId) => window.liveFixture.emit('shipment.changed', { externalId }),
    id,
  );
  await expect
    .poll(() =>
      page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key) ?? '{}').records?.[id], {
        key: `grd.tracking-review.v1:${accountFixture.externalId}`,
        id,
      }),
    )
    .toBeUndefined();
});

test('blocked storage and denied audio preserve usable shipment controls without repeated playback attempts', async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await context.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('grd.tracking-review')) throw new Error('Blocked');
      return original.call(this, key);
    };
  });
  await open(page);
  await expect(page.getByText(/Review storage is unavailable or invalid/)).toBeVisible();
  await page.evaluate(() => {
    window.reviewAudio.deny = true;
  });
  await page.getByRole('switch', { name: 'Tracking sound' }).click();
  await expect(page.getByText(/Sound could not play/)).toBeVisible();
  row(state, 0).currentTracking = snapshot(3);
  await emit(page, row(state, 0).externalId, 3);
  await expect(marks(page)).toHaveCount(1);
  await expect(
    page.getByText('1 shipment updated. Updates may be outside this view.'),
  ).toBeVisible();
  expect(await plays(page)).toBe(1);
});

test('logout clears transient alerts and another account starts without prior marks or sound preference', async ({
  page,
  context,
}) => {
  const state = await setup(context);
  await open(page);
  await page.getByRole('switch', { name: 'Tracking sound' }).click();
  row(state, 0).currentTracking = snapshot(3);
  await emit(page, row(state, 0).externalId, 3);
  await expect(marks(page)).toHaveCount(1);
  if ((page.viewportSize()?.width ?? 0) < 768)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  state.account = { ...accountFixture, externalId: '11111111-1111-4111-8111-111111111112' };
  await page.getByLabel('Email').fill('another@example.test');
  await page.getByLabel('Password', { exact: true }).fill('fixture password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shipments', exact: true })).toBeVisible();
  await expect(marks(page)).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Tracking sound' })).not.toBeChecked();
  await expect(page.locator('.MuiSnackbar-root')).toHaveCount(0);
});

test('unseen off-page tracking updates rise first and acknowledgement restores the selected sort', async ({
  page,
  context,
}) => {
  const state = await setup(context);
  state.rows = Array.from({ length: 26 }, (_, index) =>
    shipmentFixture(index + 1, { currentTracking: snapshot(index + 1) }),
  );
  await open(page, '/shipments?tab=all&sortBy=trackingReference&sortDirection=asc');
  const first = row(state, 0);
  const last = row(state, 25);
  await expect(page.getByRole('link', { name: last.trackingReference, exact: true })).toHaveCount(
    0,
  );
  last.currentTracking = snapshot(100);
  await emit(page, last.externalId, 100);
  const references = page.getByRole('link', { name: /^000\d+$/ });
  await expect(references.first()).toHaveText(last.trackingReference);
  await expect(marks(page)).toHaveCount(1);
  await page.reload();
  await expect(references.first()).toHaveText(last.trackingReference);
  await page.getByRole('button', { name: 'Mark displayed changes as seen' }).click();
  await expect(references.first()).toHaveText(first.trackingReference);
  await expect(page.getByRole('link', { name: last.trackingReference, exact: true })).toHaveCount(
    0,
  );
  await expect(page).toHaveURL(/sortBy=trackingReference&sortDirection=asc/);
});
