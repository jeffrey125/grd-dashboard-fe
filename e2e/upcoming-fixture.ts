import type { Page } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

export const repA = 'recAAAAAAAAAAAAAA';
export const repB = 'recBBBBBBBBBBBBBB';
export const upcomingReps = [
  { id: repA, name: 'Taylor Example', email: accountFixture.email },
  { id: repB, name: 'Morgan Example', email: 'morgan@example.test' },
];
const upcomingAccess = {
  enabled: true,
  administrator: false,
  repIds: [repA, repB],
  from: '2026-11-17',
  month: '2026-11',
  monthEnd: '2026-11-30',
  weekEnd: '2026-11-22',
  through: '2026-11-30',
  timezone: 'America/Chicago',
};
const upcomingOrders = Array.from({ length: 26 }, (_, i) => ({
  id: `rec${String(i + 1).padStart(14, '0')}`,
  requestedShipOn: i === 25 ? '2026-11-25' : '2026-11-18',
  salesOrders: [`SO-${100 + i}`],
  customer: `Example Foods ${i + 1}`,
  customerPo: `PO-${i + 1}`,
  repIds: [i % 2 ? repB : repA],
  reps: [i % 2 ? 'Morgan Example' : 'Taylor Example'],
  tracking: null,
  notes: 'Fictional shipment used for UI verification.',
  pallets: 2,
  lines: [
    {
      lineNumber: 1,
      product: 'Example organic flour',
      vendor: 'Sample Ingredients',
      purchaseOrder: '0',
      pounds: 2000,
      units: 40,
      origin: 'Chicago',
    },
  ],
  airtableUrl: `https://airtable.com/appxyP3yY5YF9plDO/tbl7X5ROha1PzgGZt/rec${String(i + 1).padStart(14, '0')}`,
}));
export async function installUpcomingFixture(
  page: Page,
  { admin = false, enabled = true, stale = false } = {},
) {
  await installLiveFixture(page);
  const access = { ...upcomingAccess, administrator: admin, enabled };
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { ...accountFixture, role: admin ? 'admin' : 'staff' } }),
  );
  await page.route('**/api/v1/upcoming-shipments/*/files', (route) =>
    route.fulfill({ json: { files: [] } }),
  );
  await page.route('**/api/v1/upcoming-shipments/access', (route) =>
    route.fulfill({ json: access }),
  );
  await page.route('**/api/v1/upcoming-shipments?*', (route) => {
    const window = new URL(route.request().url()).searchParams.get('window') ?? 'month';
    const orders = upcomingOrders.filter(
      (order) => window === 'month' || order.requestedShipOn <= access.weekEnd,
    );
    return route.fulfill({
      json: {
        ...access,
        through: window === 'month' ? access.monthEnd : access.weekEnd,
        window,
        updatedAt: '2026-11-17T18:00:00Z',
        stale,
        reps: upcomingReps.map(({ id, name }) => ({ id, name })),
        orders,
        total: orders.length,
      },
    });
  });
}
