import type { Shipment, TrackingRun } from '@features/shipments/schemas';
import { expect, type Page, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { emptyShipments, shipmentFixture } from '@test/shipment-fixture';
import { installLiveFixture } from './live-fixture';

test.use({ timezoneId: 'America/Los_Angeles' });

function run(index = 1): TrackingRun {
  return {
    externalId: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    trigger: 'manual',
    fetchMode: 'request',
    status: 'queued',
    attemptCount: 1,
    createdAt: '2026-10-16T14:00:00.000Z',
    startedAt: null,
    completedAt: null,
  };
}
async function setup(page: Page, overrides: Partial<Shipment> = {}) {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  const state = {
    row: shipmentFixture(1, { notes: 'Original note', ...overrides }),
    missing: false,
    failure: false,
    saveFailure: false,
    delaySave: false,
    patches: [] as unknown[],
    deleteCount: 0,
    runReads: 0,
    reads: 0,
    runs: [run()],
  };
  await page.route(/\/api\/v1\/shipments\/[0-9a-f-]+$/, async (route) => {
    if (state.missing) return route.fulfill({ status: 404, json: {} });
    if (route.request().method() === 'PATCH') {
      state.patches.push(route.request().postDataJSON());
      if (state.delaySave) await new Promise((done) => setTimeout(done, 400));
      if (state.saveFailure) return route.fulfill({ status: 500, json: { message: 'private' } });
      state.row = { ...state.row, ...route.request().postDataJSON() };
    } else if (route.request().method() === 'DELETE') {
      state.deleteCount++;
      state.missing = true;
      return route.fulfill({ status: 204 });
    } else {
      state.reads++;
      if (state.failure) return route.fulfill({ status: 500, json: {} });
    }
    return route.fulfill({ json: state.row });
  });
  await page.route(/\/api\/v1\/shipments\/[^/]+\/(pause|resume|refresh)$/, (route) => {
    if (route.request().url().endsWith('/refresh')) {
      state.row.latestRun = state.runs[0] ?? null;
      return route.fulfill({ status: 202, json: state.runs[0] });
    }
    const paused = route.request().url().endsWith('/pause');
    state.row.monitoringStatus = paused ? 'paused' : 'active';
    state.row.monitoringReason = paused ? 'manual' : null;
    return route.fulfill({ json: state.row });
  });
  await page.route('**/api/v1/tracking-runs/*', (route) => {
    state.runReads++;
    const result = state.runs.find((value) => route.request().url().endsWith(value.externalId));
    return route.fulfill({
      json: {
        ...result,
        carrierExternalId: state.row.carrier.externalId,
        reasonCode: null,
        attempts: [
          {
            shipmentExternalId: state.row.externalId,
            outcome: result?.status === 'failed' ? 'failed' : 'pending',
            snapshotChanged: false,
            retryable: null,
            reasonCode: null,
            completedAt: null,
          },
        ],
      },
    });
  });
  return state;
}
async function emit(page: Page, externalId: string, type = 'shipment.changed') {
  await page.evaluate(({ externalId, type }) => window.liveFixture.emit(type, { externalId }), {
    externalId,
    type,
  });
}
async function open(page: Page, state: Awaited<ReturnType<typeof setup>>) {
  await page.goto(
    `/shipments/${state.row.externalId}?returnTo=${encodeURIComponent('/shipments?tab=all&q=001&page=2')}`,
  );
  await expect(
    page.getByRole('heading', { name: state.row.trackingReference, exact: true }),
  ).toBeVisible();
}

test('direct links show separate truthful states, safe links, dates and responsive layout', async ({
  page,
}) => {
  const state = await setup(page, {
    verificationUrl: 'https://carrier.example/track?id=001',
    currentTracking: {
      externalId: '30000000-0000-4000-8000-000000000001',
      carrierStatus: 'In transit',
      carrierStatusDetail: 'Departed facility',
      pickedUpOn: '2026-10-14',
      estimatedDeliveryOn: '2026-10-20',
      deliveredOn: null,
      observedAt: '2026-10-16T14:00:00.000Z',
    },
    latestLookup: {
      runExternalId: run().externalId,
      outcome: 'failed',
      completedAt: '2026-10-16T15:00:00.000Z',
      snapshotChanged: false,
      retryable: true,
      reasonCode: 'PRIVATE_DIAGNOSTIC',
    },
  });
  await open(page, state);
  const tracking = page.getByRole('region', { name: 'Tracking', exact: true });
  await expect(tracking.getByText('In transit', { exact: true })).toBeVisible();
  await expect(tracking.getByText('2026-10-20', { exact: true })).toBeVisible();
  await expect(tracking.getByText('Latest lookup failed.', { exact: false })).toBeVisible();
  await expect(page.getByText('PRIVATE_DIAGNOSTIC')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'History' })).toBeVisible();
  const verify = page.getByRole('link', { name: 'Verify with carrier' });
  await expect(verify).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(verify).toHaveAttribute('target', '_blank');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `/tmp/grd-detail-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
  state.row.verificationUrl = 'javascript:alert(1)';
  await emit(page, state.row.externalId);
  await expect(verify).toHaveCount(0);
  state.failure = true;
  await emit(page, state.row.externalId);
  await expect(page.getByText(/Showing previously loaded data/)).toBeVisible();
  await expect(tracking.getByText('In transit', { exact: true })).toBeVisible();
});

test('draft survives live updates, detects conflict, adopts latest, validates and clears to null', async ({
  page,
}) => {
  const state = await setup(page);
  await open(page, state);
  await page.getByRole('button', { name: 'Edit notes' }).click();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('My draft');
  state.row.notes = 'Other staff note';
  await emit(page, state.row.externalId);
  await expect(page.getByText('Notes changed elsewhere')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('My draft');
  await page.getByRole('button', { name: 'Use latest note' }).click();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(
    'Other staff note',
  );
  await expect(page.getByRole('button', { name: 'Save notes' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('x'.repeat(501));
  await page.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByText('Use at most 500 characters.')).toBeVisible();
  expect(state.patches).toEqual([]);
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('  ');
  state.delaySave = true;
  await page.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete shipment', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Edit notes' })).toBeVisible();
  expect(state.patches).toEqual([{ notes: null }]);
  await expect(
    page.getByRole('region', { name: 'Notes', exact: true }).getByText('No notes'),
  ).toBeVisible();
});

test('explicit overwrite, failed save retention, cancel and dirty navigation', async ({ page }) => {
  const state = await setup(page);
  await open(page, state);
  await page.getByRole('button', { name: 'Edit notes' }).click();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Mine');
  state.row.notes = 'Theirs';
  await emit(page, state.row.externalId);
  await expect(page.getByText('Notes changed elsewhere')).toBeVisible();
  state.saveFailure = true;
  await page.getByRole('button', { name: 'Save my draft anyway' }).click();
  await expect(
    page
      .getByRole('form', { name: 'Edit shipment notes' })
      .getByRole('alert')
      .filter({ hasText: 'server could not complete' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('Mine');
  state.saveFailure = false;
  await page.locator('.MuiSnackbar-root').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Save my draft anyway' }).click();
  await expect(page.getByRole('button', { name: 'Edit notes' })).toBeVisible();
  expect(state.row.notes).toBe('Mine');
  await page.getByRole('button', { name: 'Edit notes' }).click();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Unsaved');
  await page.getByRole('link', { name: 'Back to results' }).click();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved note changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('Unsaved');
  await page.getByRole('link', { name: 'Back to results' }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page).toHaveURL(/\/shipments\?tab=all&q=001&page=2$/);
});

test('browser back and reload protect dirty notes; Cancel restores latest saved note', async ({
  page,
}) => {
  const state = await setup(page);
  await page.route('**/api/v1/shipments/search?*', (route) =>
    route.fulfill({
      json: {
        ...emptyShipments,
        items: [state.row],
        total: 1,
        tabCounts: { ...emptyShipments.tabCounts, all: 1, active: 1 },
      },
    }),
  );
  await page.goto('/shipments');
  await page.getByRole('link', { name: state.row.trackingReference, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: state.row.trackingReference, exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit notes' }).click();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Unsaved');
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved note changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page).toHaveURL(new RegExp(`/shipments/${state.row.externalId}`));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const dialog = page.waitForEvent('dialog');
  // A dismissed beforeunload intentionally never reaches Playwright's load event.
  const reload = page.reload({ timeout: 2000 }).catch(() => {});
  const warning = await dialog;
  expect(warning.type()).toBe('beforeunload');
  await warning.dismiss();
  await reload;
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Notes', exact: true }).getByText('Original note'),
  ).toBeVisible();
});

test('delete identifies the reference and discards dirty notes with only one confirmation', async ({
  page,
}) => {
  const state = await setup(page);
  await open(page, state);
  await page.getByRole('button', { name: 'Edit notes' }).click();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Unsaved');
  await page.getByRole('button', { name: 'Delete shipment', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete shipment?' });
  await expect(dialog.getByText(`UPS · ${state.row.trackingReference}`)).toBeVisible();
  await expect(dialog.getByText(/unsaved note changes will also be discarded/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(state.deleteCount).toBe(0);
  await page.getByRole('button', { name: 'Delete shipment', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete shipment', exact: true }).click();
  await expect(page).toHaveURL(/\/shipments\?tab=all&q=001&page=2$/);
  expect(state.deleteCount).toBe(1);
  expect(state.patches).toEqual([]);
});

test('live deletion clears stale detail and stops editing; missing direct links recover safely', async ({
  page,
}) => {
  const state = await setup(page);
  await open(page, state);
  await page.getByRole('button', { name: 'Edit notes' }).click();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Unsaved');
  state.missing = true;
  await emit(page, state.row.externalId);
  await expect(page.getByRole('heading', { name: 'Shipment unavailable' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Shipment unavailable' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to results' }).click();
  await expect(page).toHaveURL(/\/shipments\?/);
  const reads = state.reads;
  await page.goto('/shipments/new');
  await expect(page.getByRole('heading', { name: 'Page not available' })).toBeVisible();
  expect(state.reads).toBe(reads);
});

test('manual run stays visible beside newer run, duplicate requests coalesce and polling stops', async ({
  page,
}) => {
  const state = await setup(page);
  await page.clock.install();
  await open(page, state);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  const manual = page.getByRole('region', { name: /Your refresh/ });
  await expect(manual.getByText('Run: queued', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(manual).toHaveCount(1);
  const later: TrackingRun = { ...run(2), trigger: 'scheduled', status: 'running' };
  state.runs.push(later);
  state.row.latestRun = later;
  const first = state.runs[0] as TrackingRun;
  first.status = 'running';
  await emit(page, later.externalId, 'run.changed');
  await expect(page.getByRole('region', { name: 'Latest run', exact: true })).toBeVisible();
  await expect(manual).toBeVisible();
  const before = state.runReads;
  await page.clock.fastForward(16000);
  await expect.poll(() => state.runReads).toBeGreaterThan(before);
  first.status = 'failed';
  later.status = 'succeeded';
  await emit(page, first.externalId, 'run.changed');
  await emit(page, later.externalId, 'run.changed');
  await expect(manual.getByText('Run: failed', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Latest run', exact: true })
      .getByText('Run: succeeded', { exact: true }),
  ).toBeVisible();
  const stopped = state.runReads;
  await page.clock.fastForward(31000);
  expect(state.runReads).toBe(stopped);
});

test('action availability follows manual pause, threshold pause, delivery and disabled carrier', async ({
  page,
}) => {
  const state = await setup(page);
  await open(page, state);
  await page.getByRole('button', { name: 'Pause monitoring', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume monitoring', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resume monitoring', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause monitoring', exact: true })).toBeVisible();
  state.row.monitoringStatus = 'paused';
  state.row.monitoringReason = 'not_found_threshold';
  await emit(page, state.row.externalId);
  await expect(page.getByText(/Paused after repeated not-found results/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume monitoring', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  state.row.monitoringStatus = 'completed';
  state.row.monitoringReason = 'delivered';
  await emit(page, state.row.externalId);
  await expect(
    page.getByText('Set a future follow-up date to monitor this delivered shipment.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
  state.row.monitoringStatus = 'active';
  state.row.monitoringReason = null;
  state.row.carrier.isActive = false;
  await emit(page, state.row.externalId);
  await expect(page.getByText('Carrier is disabled.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
});

test('a finished refresh response is rendered immediately without implying delivery', async ({
  page,
}) => {
  const state = await setup(page);
  const finished = state.runs[0] as TrackingRun;
  finished.status = 'succeeded';
  finished.completedAt = '2026-10-16T14:01:00.000Z';
  await open(page, state);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByRole('region', { name: /Your refresh/ }).getByText('Run: succeeded', { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Tracking', exact: true })
      .getByText('No tracking snapshot recorded yet.'),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Monitoring', exact: true })
      .getByText('Active', { exact: true }),
  ).toBeVisible();
});

test('a stale save response cannot overwrite newer server notes or monitoring data', async ({
  page,
}) => {
  const state = await setup(page);
  await open(page, state);
  await page.getByRole('button', { name: 'Edit notes' }).click();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('My submitted note');
  await page.route(`**/api/v1/shipments/${state.row.externalId}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const response = { ...state.row, notes: 'My submitted note' };
    state.row = {
      ...state.row,
      notes: 'Newer server note',
      monitoringStatus: 'paused',
      monitoringReason: 'manual',
    };
    await emit(page, state.row.externalId);
    return route.fulfill({ json: response });
  });
  await page.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByRole('button', { name: 'Edit notes' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Notes', exact: true }).getByText('Newer server note'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume monitoring', exact: true })).toBeVisible();
});

test('dark theme and maximum-length content remain usable; sidebar navigation protects notes', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const state = await setup(page, { trackingReference: '0'.repeat(255), notes: 'N'.repeat(500) });
  await open(page, state);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `/tmp/grd-detail-dark-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Edit notes' }).click();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Dirty');
  if ((page.viewportSize()?.width ?? 0) < 900)
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Overview', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved note changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page).toHaveURL('/');
});

test('failure-paused shipments explain Retry now and still respect carrier disablement', async ({
  page,
}) => {
  const state = await setup(page, {
    monitoringStatus: 'paused',
    monitoringReason: 'failure_threshold',
    consecutiveFailureCount: 2,
  });
  await open(page, state);
  await expect(
    page.getByText('Paused: repeated lookup failures', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText('Paused after repeated lookup failures.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry now', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Resume monitoring', exact: true })).toHaveCount(0);
  state.row.carrier.isActive = false;
  await emit(page, state.row.externalId);
  await expect(page.getByRole('button', { name: 'Retry now', exact: true })).toBeDisabled();
  await expect(page.getByText('Carrier is disabled.', { exact: true })).toBeVisible();
});

test('edits and clears shipment business fields', async ({ page }) => {
  const state = await setup(page, {
    poNumber: '0001',
    customer: 'Original customer',
    vendor: 'Original vendor',
  });
  await page.route('**/api/v1/sales-reps', (route) => route.fulfill({ json: [] }));
  await open(page, state);
  await page.getByLabel('PO#', { exact: true }).fill(' 0002-a ');
  await page.getByLabel('Customer', { exact: true }).fill(' Updated customer ');
  await page.getByLabel('Vendor', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save assignment', exact: true }).click();
  await expect(page.getByText('Shipment changes saved.', { exact: true })).toBeVisible();
  expect(state.patches[0]).toEqual({
    poNumber: '0002-a',
    customer: 'Updated customer',
    vendor: null,
  });
  await page.reload();
  await expect(page.getByLabel('PO#', { exact: true })).toHaveValue('0002-a');
  await expect(page.getByLabel('Vendor', { exact: true })).toHaveValue('');
});
