import { mkdir, writeFile } from 'node:fs/promises';
import { expect, type Locator, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { overviewFixture } from '@test/overview-fixture';
import { emptyShipments, shipmentFixture } from '@test/shipment-fixture';
import { installLiveFixture } from './live-fixture';

// Explicit opt-in generation with fictional data, never production screenshots.
test('capture fictional help screenshots', async ({ page }) => {
  test.skip(process.env.UPDATE_HELP_SCREENSHOTS !== 'true');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await installLiveFixture(page);
  let admin = false;
  const actor = { ...accountFixture, firstName: 'Jordan', lastName: 'Example' };
  const row = shipmentFixture(1, {
    trackingReference: 'DEMO-001',
    poNumber: 'PO-001',
    customer: 'Example Foods',
    vendor: 'Sample Ingredients',
    notes: 'Example shipment for the help guide.',
    currentTracking: {
      externalId: '33333333-3333-4333-8333-333333333333',
      carrierStatus: 'In transit',
      carrierStatusDetail: 'Departed facility',
      pickedUpOn: '2026-10-16',
      estimatedDeliveryOn: '2026-10-20',
      deliveredOn: null,
      observedAt: '2026-10-17T14:00:00Z',
    },
  });
  const rep = {
    externalId: '22222222-2222-4222-8222-222222222222',
    firstName: 'Taylor',
    lastName: 'Example',
    email: 'taylor@example.test',
    active: true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: null,
  };
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { ...actor, role: admin ? 'admin' : 'staff' } }),
  );
  const mocks: [string | RegExp, unknown][] = [
    ['**/api/v1/dashboard/overview?*', overviewFixture()],
    ['**/api/v1/carriers', [row.carrier]],
    ['**/api/v1/sales-reps', [rep]],
    ['**/api/v1/sales-reps/filter-options', [rep]],
    [
      '**/api/v1/shipments/search?*',
      {
        ...emptyShipments,
        items: [row],
        total: 1,
        tabCounts: { ...emptyShipments.tabCounts, all: 1, active: 1 },
      },
    ],
    [/\/api\/v1\/shipments\/[0-9a-f-]+$/, row],
    [
      '**/api/v1/shipments/*/history?*',
      { items: [row.currentTracking], page: 1, pageSize: 25, total: 1 },
    ],
    [
      '**/api/v1/admin/accounts',
      [
        { ...actor, role: 'admin' },
        { ...actor, externalId: rep.externalId, firstName: 'Casey', email: 'casey@example.test' },
      ],
    ],
    ['**/api/v1/admin/sales-reps', [rep]],
    [
      '**/api/v1/quote-comparisons/providers',
      [
        {
          code: 'unishippers',
          name: 'myUnishippers',
          enabled: true,
          executionMode: 'request',
          usedInternationally: true,
          internationalAvailable: false,
          supportsSignature: false,
          supportsInsurance: false,
        },
      ],
    ],
  ];
  for (const [url, json] of mocks) await page.route(url, (route) => route.fulfill({ json }));
  const captures: Record<string, unknown> = {};
  await mkdir('public/help/screenshots', { recursive: true });
  async function capture(name: string, targets: Locator[]) {
    const main = page.getByRole('main');
    for (const target of targets) await expect(target).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // Crop unused viewport space without changing the screen's content or width.
    const previousMinHeight = await main.evaluate((element) => {
      const previous = element.style.minHeight;
      element.style.minHeight = '0';
      return previous;
    });
    const box = await main.boundingBox();
    if (!box) throw new Error('Missing screenshot bounds');
    const markers = [];
    for (const target of targets) {
      const b = await target.boundingBox();
      if (!b) throw new Error('Missing marker target');
      markers.push({
        x: (Math.max(14, b.x - box.x - 12) / box.width) * 100,
        y: ((b.y - box.y + 14) / box.height) * 100,
      });
    }
    await main.screenshot({ path: `public/help/screenshots/${name}.png`, animations: 'disabled' });
    captures[name] = { width: box.width, height: box.height, markers };
    await main.evaluate((element, previous) => {
      element.style.minHeight = previous;
    }, previousMinHeight);
  }
  const region = (name: string) => page.getByRole('region', { name, exact: true });
  await page.goto('/');
  await capture('overview', [
    page.getByRole('link', { name: 'All shipments: 1200' }),
    region('Needs attention'),
    region('Upcoming deliveries'),
  ]);
  await page.goto('/shipments');
  await capture('shipments', [
    page.getByRole('form', { name: 'Add shipment', exact: true }),
    page.getByLabel('Search reference or notes'),
    page.getByRole('grid', { name: 'Shipments' }),
  ]);
  const otherCarrier = {
    ...row.carrier,
    externalId: '10000000-0000-4000-8000-000000000002',
    code: 'other',
    name: 'Other',
  };
  const otherRow = {
    ...row,
    trackingReference: 'MANUAL-DEMO-001',
    carrier: otherCarrier,
    currentTracking: { ...row.currentTracking, carrierStatus: 'Pickedup' },
  };
  await page.route('**/api/v1/carriers', (route) =>
    route.fulfill({ json: [row.carrier, otherCarrier] }),
  );
  await page.route('**/api/v1/shipments/search?*', (route) =>
    route.fulfill({
      json: {
        ...emptyShipments,
        items: [otherRow],
        total: 1,
        tabCounts: { ...emptyShipments.tabCounts, all: 1, active: 1, other: 1 },
      },
    }),
  );
  await page.goto('/shipments?tab=other');
  const addForm = page.getByRole('form', { name: 'Add shipment', exact: true });
  await addForm.getByLabel('Carrier', { exact: true }).selectOption(otherCarrier.externalId);
  await addForm.getByLabel('Tracking reference', { exact: true }).fill('MANUAL-DEMO-002');
  await capture('other', [
    page.getByRole('tab', { name: /^Other/ }),
    addForm.getByLabel('Carrier', { exact: true }),
    addForm.getByLabel('Carrier Status', { exact: true }),
  ]);
  await page.goto(`/shipments/${row.externalId}`);
  await capture('details', [region('Tracking'), region('Shipment details'), region('Notes')]);
  await page.getByRole('tab', { name: 'Audit', exact: true }).click();
  await capture('audit', [
    region('Monitoring'),
    region('Latest lookup & run'),
    region('Shipment audit'),
  ]);
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await capture('history', [
    page.getByRole('tab', { name: 'History', exact: true }),
    page.getByRole('article').first(),
  ]);
  await page.goto('/quotes/new');
  await page.getByRole('button', { name: 'Recipient: Enter address manually' }).click();
  await capture('quotes', [
    page.getByRole('heading', { name: '1. Choose your shipping services' }),
    page.getByLabel('Recipient company or name', { exact: false }),
    page.getByRole('button', { name: 'Compare quotes', exact: true }),
  ]);
  admin = true;
  await page.goto('/admin/accounts');
  await capture('accounts', [
    page.getByRole('heading', { name: 'Accounts', exact: true }),
    page.getByRole('link', { name: 'Create account', exact: true }),
  ]);
  await page.goto('/admin/sales-reps');
  await capture('sales-reps', [
    page.getByRole('heading', { name: 'Sales Reps', exact: true }),
    page.getByRole('button', { name: 'Add Sales Rep', exact: true }),
  ]);
  await writeFile('src/features/help/captures.json', `${JSON.stringify(captures, null, 2)}\n`);
});
