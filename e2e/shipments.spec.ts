import { expect, type Locator, type Page, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { emptyShipments, shipmentFixture } from '@test/shipment-fixture';
import { installLiveFixture } from './live-fixture';

async function setup(page: Page) {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  await page.route('**/api/v1/carriers', (route) =>
    route.fulfill({ json: [shipmentFixture().carrier] }),
  );
  const state = {
    queries: [] as URLSearchParams[],
    commands: [] as string[],
    rows: Array.from({ length: 30 }, (_, i) => shipmentFixture(i + 1)),
    fail: false,
    conflict: false,
    delay: 0,
  };
  await page.route('**/api/v1/shipments/search?*', async (route) => {
    const params = new URL(route.request().url()).searchParams;
    state.queries.push(params);
    if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
    if (state.fail) return route.fulfill({ status: 500, json: {} });
    let rows = state.rows.filter(
      (row) => !params.get('q') || row.trackingReference.includes(params.get('q') ?? ''),
    );
    const counts = {
      all: rows.length,
      active: rows.filter((row) => row.monitoringStatus === 'active').length,
      paused: rows.filter((row) => row.monitoringStatus === 'paused').length,
      delivered: 0,
      attention: rows.filter((row) => row.monitoringReason === 'not_found_threshold').length,
    };
    const tab = params.get('tab');
    if (tab === 'active' || tab === 'paused')
      rows = rows.filter((row) => row.monitoringStatus === tab);
    if (tab === 'attention')
      rows = rows.filter((row) => row.monitoringReason === 'not_found_threshold');
    if (params.get('sortBy') === 'trackingReference')
      rows.sort(
        (a, b) =>
          a.trackingReference.localeCompare(b.trackingReference) *
          (params.get('sortDirection') === 'asc' ? 1 : -1),
      );
    const page = Number(params.get('page') ?? 1),
      pageSize = Number(params.get('pageSize') ?? 25);
    return route.fulfill({
      json: {
        ...emptyShipments,
        items: rows.slice((page - 1) * pageSize, page * pageSize),
        total: rows.length,
        page,
        pageSize,
        tabCounts: counts,
      },
    });
  });
  await page.route(/\/api\/v1\/shipments\/[^/]+\/(pause|resume|refresh)$/, async (route) => {
    state.commands.push(route.request().url());
    if (state.conflict) return route.fulfill({ status: 409, json: {} });
    const row = state.rows.find((item) => route.request().url().includes(item.externalId));
    if (!row) return route.fulfill({ status: 404, json: {} });
    if (route.request().url().endsWith('refresh'))
      return route.fulfill({
        status: 202,
        json: {
          externalId: '20000000-0000-4000-8000-000000000001',
          trigger: 'manual',
          fetchMode: 'request',
          status: 'queued',
          attemptCount: 1,
          createdAt: row.createdAt,
          startedAt: null,
          completedAt: null,
        },
      });
    row.monitoringStatus = route.request().url().endsWith('pause') ? 'paused' : 'active';
    row.monitoringReason = row.monitoringStatus === 'paused' ? 'manual' : null;
    return route.fulfill({ json: row });
  });
  return state;
}
async function actions(page: Page, reference: string) {
  const scroller = page.locator('.MuiDataGrid-virtualScroller');
  if (await scroller.count())
    await scroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
  const button = page.getByRole('button', { name: `Actions for ${reference}`, exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
}
function mobile(page: Page) {
  return (page.viewportSize()?.width ?? 0) < 900;
}
function shipmentCard(page: Page, reference: string) {
  return page.getByRole('article', { name: `Shipment ${reference}`, exact: true });
}
async function expectShipmentView(page: Page, value: string, label: string) {
  if (mobile(page)) {
    const select = page.getByRole('combobox', { name: 'Shipment view', exact: true });
    await expect(select).toHaveValue(value);
    await expect(select.locator('option:checked')).toHaveText(label);
  } else {
    await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }
}
async function chooseShipmentView(page: Page, value: string, label: string) {
  if (mobile(page))
    await page.getByRole('combobox', { name: 'Shipment view', exact: true }).selectOption(value);
  else await page.getByRole('tab', { name: label, exact: true }).click();
}
async function actionControl(page: Page, reference: string, name: string): Promise<Locator> {
  if (mobile(page)) return shipmentCard(page, reference).getByRole('button', { name, exact: true });
  await actions(page, reference);
  return page.getByRole('menuitem', { name, exact: true });
}

test('default, pagination, debounced search, sort and back/detail return retain URL state', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/shipments');
  await expectShipmentView(page, 'active', 'Active (30)');
  expect(state.queries.at(-1)?.get('sortBy')).toBe('createdAt');
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await expect(page.getByRole('link', { name: '00026', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole('link', { name: '00026', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shipment details' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to results' }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByLabel('Search reference or notes').fill('00030');
  await expect(page.getByRole('link', { name: '00030', exact: true })).toBeVisible();
  await expectShipmentView(page, 'active', 'Active (1)');
  await page.reload();
  await expect(page.getByLabel('Search reference or notes')).toHaveValue('00030');
  if (await page.getByRole('combobox', { name: 'Sort by', exact: true }).count()) {
    await page
      .getByRole('combobox', { name: 'Sort by', exact: true })
      .selectOption('trackingReference');
  } else await page.getByRole('columnheader', { name: 'Reference / carrier' }).click();
  await expect(page).toHaveURL(/sortBy=trackingReference/);
  await page.goBack();
  await expect(page).not.toHaveURL(/sortBy=trackingReference/);
  await page.getByRole('link', { name: 'Add shipments' }).click();
  await expect(page.getByText('Shipment creation is not available yet.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to results' }).click();
  await expect(page.getByLabel('Search reference or notes')).toHaveValue('00030');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('invalid dates block requests until corrected and explicitly applied', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/shipments?createdFrom=2026-10-20&createdTo=2026-10-10');
  await expect(page.getByText(/Results are paused/)).toBeVisible();
  expect(state.queries).toHaveLength(0);
  await page.getByRole('button', { name: 'Choose created to' }).click();
  await page.getByRole('gridcell', { name: '30', exact: true }).click();
  if ((page.viewportSize()?.width ?? 0) < 600)
    await page.getByRole('button', { name: 'OK', exact: true }).click();
  expect(state.queries).toHaveLength(0);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expectShipmentView(page, 'active', 'Active (30)');
  expect(state.queries.at(-1)?.get('createdTo')).toBe('2026-10-30');
  await page.getByRole('button', { name: 'Choose created from' }).click();
  await page.getByRole('gridcell', { name: '21', exact: true }).click();
  if ((page.viewportSize()?.width ?? 0) < 600)
    await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.evaluate(
    (externalId) => window.liveFixture.emit('shipment.changed', { externalId, reason: 'updated' }),
    shipmentFixture().externalId,
  );
  await expect(page.getByRole('group', { name: 'Created from', exact: true })).toHaveText(
    /2026.*10.*21/,
  );
  expect(state.queries.at(-1)?.get('createdFrom')).toBe('2026-10-20');
});

test('row actions target UUIDs, refetch conflicts, and move paused rows out of Active', async ({
  page,
}) => {
  const state = await setup(page);
  state.rows = state.rows.slice(0, 2);
  await page.goto('/shipments');
  await expectShipmentView(page, 'active', 'Active (2)');
  await (await actionControl(page, '0001', 'Refresh')).click();
  await expect(page.getByText(/refresh queued or joined/)).toBeVisible();
  expect(state.commands[0]).toContain(`${shipmentFixture().externalId}/refresh`);
  await page.locator('.MuiSnackbar-root').getByRole('button', { name: 'Close' }).click();
  const conflictingPause = await actionControl(page, '0001', 'Pause monitoring');
  await expect(conflictingPause).toBeEnabled();
  state.conflict = true;
  const calls = state.queries.length;
  await conflictingPause.click();
  await expect(page.getByText(/conflicts with the current state/)).toBeVisible();
  await expect.poll(() => state.queries.length).toBeGreaterThan(calls);
  state.conflict = false;
  await (await actionControl(page, '0001', 'Pause monitoring')).click();
  await expectShipmentView(page, 'active', 'Active (1)');
  await chooseShipmentView(page, 'paused', 'Paused (1)');
  await expectShipmentView(page, 'paused', 'Paused (1)');
  await expect(await actionControl(page, '0001', 'Resume monitoring')).toBeVisible();
  if (mobile(page)) {
    await expect(
      shipmentCard(page, '0001').getByRole('button', { name: 'Refresh' }),
    ).toBeDisabled();
    await expect(shipmentCard(page, '0001')).toContainText('Resume monitoring before refreshing.');
  } else {
    await expect(
      page.getByRole('menuitem', { name: /Resume monitoring before refreshing/ }),
    ).toHaveAttribute('aria-disabled', 'true');
  }
});

test('live deletion clamps pages and errors preserve known results with stale feedback', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/shipments?page=2');
  await expect(page.getByRole('link', { name: '00026', exact: true })).toBeVisible();
  state.rows = state.rows.slice(0, 24);
  await page.evaluate(
    (externalId) => window.liveFixture.emit('shipment.changed', { externalId, reason: 'deleted' }),
    shipmentFixture(26).externalId,
  );
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByRole('link', { name: '0001', exact: true })).toBeVisible();
  state.fail = true;
  await page.evaluate(
    (externalId) => window.liveFixture.emit('shipment.changed', { externalId, reason: 'updated' }),
    shipmentFixture().externalId,
  );
  await expect(page.getByText(/Displayed results may be stale/)).toBeVisible();
  await expect(page.getByRole('link', { name: '0001', exact: true })).toBeVisible();
  state.fail = false;
  await page.getByRole('button', { name: 'Retry results' }).click();
  await expect(page.getByText(/Displayed results may be stale/)).toHaveCount(0);
});

test('pending pages show previous data without actions and superseded searches cannot win', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/shipments');
  await expectShipmentView(page, 'active', 'Active (30)');
  state.delay = 1500;
  await page.getByRole('button', { name: 'Go to next page' }).click();
  await expect(page.getByText(/previous results are shown/)).toBeVisible();
  const scroller = page.locator('.MuiDataGrid-virtualScroller');
  if (mobile(page)) {
    await expect(
      shipmentCard(page, '0001').getByRole('button', { name: 'Refresh' }),
    ).toBeDisabled();
    await expect(
      shipmentCard(page, '00026').getByRole('button', { name: 'Refresh' }),
    ).toBeEnabled();
  } else {
    await scroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect(
      page.getByRole('button', { name: 'Actions for 0001', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Actions for 00026', exact: true }),
    ).toBeEnabled();
  }
  await page.getByLabel('Search reference or notes').fill('0001');
  await expect.poll(() => state.queries.at(-1)?.get('q')).toBe('0001');
  state.delay = 0;
  await page.getByLabel('Search reference or notes').fill('00030');
  await expectShipmentView(page, 'active', 'Active (1)');
  if (await scroller.count())
    await scroller.evaluate((element) => {
      element.scrollLeft = 0;
    });
  await expect(page.getByRole('link', { name: '00030', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '0001', exact: true })).toHaveCount(0);
});

test('live updates remove vanished row actions without acting on their replacement', async ({
  page,
}) => {
  const state = await setup(page);
  state.rows = state.rows.slice(0, 2);
  await page.goto('/shipments');
  await expectShipmentView(page, 'active', 'Active (2)');
  if (!mobile(page)) await actions(page, '0001');
  state.rows.shift();
  await page.evaluate(
    (externalId) => window.liveFixture.emit('shipment.changed', { externalId, reason: 'deleted' }),
    shipmentFixture().externalId,
  );
  await expect(page.getByRole('menu')).toHaveCount(0);
  expect(state.commands).toHaveLength(0);
  await (await actionControl(page, '0002', 'Pause monitoring')).click();
  await expect.poll(() => state.commands.length).toBe(1);
  expect(state.commands[0]).toContain(`${shipmentFixture(2).externalId}/pause`);
});

test('threshold, delivered and disabled carrier rows explain eligibility and preserve known tracking', async ({
  page,
}) => {
  const state = await setup(page);
  state.rows = [
    shipmentFixture(1, {
      monitoringStatus: 'paused',
      monitoringReason: 'not_found_threshold',
      currentTracking: {
        externalId: '30000000-0000-4000-8000-000000000001',
        carrierStatus: 'In transit',
        carrierStatusDetail: null,
        pickedUpOn: null,
        estimatedDeliveryOn: '2026-10-20',
        deliveredOn: null,
        observedAt: '2026-10-16T14:00:00Z',
      },
      latestLookup: {
        runExternalId: '20000000-0000-4000-8000-000000000001',
        outcome: 'not_found',
        snapshotChanged: false,
        retryable: null,
        reasonCode: null,
        completedAt: '2026-10-16T14:00:00Z',
      },
    }),
    shipmentFixture(2, { monitoringStatus: 'completed', monitoringReason: 'delivered' }),
    shipmentFixture(3, { carrier: { ...shipmentFixture().carrier, isActive: false } }),
  ];
  await page.goto('/shipments?tab=all');
  await expect(page.getByRole('link', { name: '0001', exact: true })).toBeVisible();
  await expect(await actionControl(page, '0001', 'Refresh')).toBeEnabled();
  if (mobile(page)) {
    await expect(
      shipmentCard(page, '0001').getByRole('button', { name: 'Resume monitoring' }),
    ).toHaveCount(0);
    await expect(
      shipmentCard(page, '0002').getByRole('button', { name: 'Refresh' }),
    ).toBeDisabled();
    await expect(shipmentCard(page, '0002')).toContainText('Delivered shipments cannot refresh.');
    await expect(
      shipmentCard(page, '0003').getByRole('button', { name: 'Refresh' }),
    ).toBeDisabled();
    await expect(shipmentCard(page, '0003')).toContainText('Carrier is disabled.');
    await expect(
      shipmentCard(page, '0003').getByRole('button', { name: 'Pause monitoring' }),
    ).toBeEnabled();
  } else {
    await expect(
      page.getByRole('menuitem', { name: 'Resume monitoring', exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await actions(page, '0002');
    await expect(
      page.getByRole('menuitem', { name: /Delivered shipments cannot refresh/ }),
    ).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await actions(page, '0003');
    await expect(page.getByRole('menuitem', { name: /Carrier is disabled/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(
      page.getByRole('menuitem', { name: 'Pause monitoring', exact: true }),
    ).toBeEnabled();
  }
});

test('page size controls remain available on narrow screens and reset to the first page', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/shipments?page=2');
  await expect(page.getByRole('link', { name: '00026', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Rows per page:' }).click();
  await page.getByRole('option', { name: '50', exact: true }).click();
  await expect.poll(() => state.queries.at(-1)?.get('pageSize')).toBe('50');
  await expect(page).toHaveURL(/page=1/);
  const footer = await page.locator('.MuiTablePagination-root').boundingBox();
  const next = await page.getByRole('button', { name: 'Go to next page' }).boundingBox();
  if (!footer || !next) throw new Error('Missing pagination controls');
  expect(next.y + next.height).toBeLessThanOrEqual(footer.y + footer.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('run-only events refresh the displayed latest run without changing sort', async ({ page }) => {
  const state = await setup(page);
  const row = shipmentFixture(1, {
    latestRun: {
      externalId: '20000000-0000-4000-8000-000000000001',
      trigger: 'manual',
      fetchMode: 'request',
      status: 'queued',
      attemptCount: 1,
      createdAt: '2026-10-16T14:00:00Z',
      startedAt: null,
      completedAt: null,
    },
  });
  state.rows = [row];
  await page.goto('/shipments');
  await expectShipmentView(page, 'active', 'Active (1)');
  if (!row.latestRun) throw new Error('Expected run fixture');
  row.latestRun.status = 'running';
  row.latestRun.startedAt = '2026-10-16T14:01:00Z';
  await page.evaluate(
    (externalId) => window.liveFixture.emit('run.changed', { externalId }),
    row.latestRun.externalId,
  );
  const scroller = page.locator('.MuiDataGrid-virtualScroller');
  if (await scroller.count())
    await scroller.evaluate((element) => {
      element.scrollLeft = 760;
    });
  await expect(page.getByText('Run: running', { exact: true })).toBeVisible();
  expect(state.queries.at(-1)?.get('sortBy')).toBe('createdAt');
  expect(state.queries.at(-1)?.get('sortDirection')).toBe('desc');
});

test('responsive cards retain all details, wrap long text, and preserve state across resizing', async ({
  page,
}) => {
  const state = await setup(page);
  const reference = '000000000000000000000000000000001';
  state.rows = [
    shipmentFixture(1, {
      trackingReference: reference,
      notes: 'LongNote'.repeat(35),
      currentTracking: {
        externalId: '30000000-0000-4000-8000-000000000001',
        carrierStatus: 'In transit',
        carrierStatusDetail: null,
        pickedUpOn: '2026-10-17',
        estimatedDeliveryOn: '2026-10-20',
        deliveredOn: null,
        observedAt: '2026-10-16T14:00:00Z',
      },
    }),
  ];
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/shipments');
  const card = page.getByRole('article', { name: `Shipment ${reference}` });
  await expect(card).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Shipment view', exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('grid', { name: 'Shipments' })).toHaveCount(0);
  await expect(card.getByText('Carrier status', { exact: true })).toBeVisible();
  await expect(card.getByText('Monitoring', { exact: true })).toBeVisible();
  await expect(card.getByText('Pickup', { exact: true })).toBeVisible();
  await expect(card.getByText('2026-10-17', { exact: true })).toBeVisible();
  await expect(card.getByText('Delivery', { exact: true })).toBeVisible();
  await expect(card.getByText('Latest lookup', { exact: true })).toBeVisible();
  await expect(card.getByText('LongNote'.repeat(35), { exact: true })).toBeVisible();
  await expect(card.getByRole('link', { name: 'View details', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Pause monitoring', exact: true })).toBeVisible();
  await expect(card.locator('[aria-haspopup="menu"]')).toHaveCount(0);
  const cardBounds = await card.boundingBox();
  const actionBounds = await Promise.all(
    [
      card.getByRole('link', { name: 'View details', exact: true }),
      card.getByRole('button', { name: 'Refresh', exact: true }),
      card.getByRole('button', { name: 'Pause monitoring', exact: true }),
    ].map((control) => control.boundingBox()),
  );
  if (!cardBounds || actionBounds.some((bounds) => !bounds))
    throw new Error('Missing mobile card action bounds');
  for (const bounds of actionBounds) {
    if (!bounds) continue;
    expect(bounds.width).toBeGreaterThan(cardBounds.width - 40);
  }
  expect(actionBounds[1]?.y).toBeGreaterThan(actionBounds[0]?.y ?? 0);
  expect(actionBounds[2]?.y).toBeGreaterThan(actionBounds[1]?.y ?? 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('combobox', { name: 'Sort direction' }).selectOption('asc');
  await expect(page).toHaveURL(/sortDirection=asc/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('tab', { name: 'Active (1)', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Shipment view', exact: true })).toBeHidden();
  await expect(page.getByRole('grid', { name: 'Shipments' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Pickup', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Delivery', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page).toHaveURL(/sortDirection=asc/);
});

test.describe('touch calendar filters', () => {
  test.use({ hasTouch: true, isMobile: true, timezoneId: 'America/Los_Angeles' });
  test('replaces an impossible URL date, applies all four dates, and clears explicitly', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T14:00:00Z'));
    const state = await setup(page);
    await page.goto('/shipments?createdFrom=2025-02-29');
    await expect(page.getByText(/Invalid date: 2025-02-29/)).toBeVisible();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    expect(state.queries).toHaveLength(0);
    for (const label of ['created from', 'created to', 'delivery from', 'delivery to']) {
      await page.getByRole('button', { name: `Choose ${label}`, exact: true }).click();
      await page.getByRole('gridcell', { name: '20', exact: true }).click();
      await page.getByRole('button', { name: 'OK', exact: true }).click();
    }
    expect(state.queries).toHaveLength(0);
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expectShipmentView(page, 'active', 'Active (30)');
    for (const key of [
      'createdFrom',
      'createdTo',
      'estimatedDeliveryFrom',
      'estimatedDeliveryTo',
    ]) {
      expect(state.queries.at(-1)?.get(key)).toBe('2026-10-20');
    }
    await page.getByRole('button', { name: 'Clear created from', exact: true }).click();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).not.toHaveURL(/createdFrom=/);
    await expect(page).toHaveURL(/estimatedDeliveryFrom=2026-10-20/);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page).not.toHaveURL(/createdTo=|estimatedDelivery/);
  });
});
