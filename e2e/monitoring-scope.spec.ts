import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { emptyOverview } from '@test/overview-fixture';
import { emptyShipments, shipmentFixture } from '@test/shipment-fixture';
import { installLiveFixture } from './live-fixture';

test('Personal default, saved preference, shared views, pagination reset and creator isolation', async ({
  page,
}) => {
  await installLiveFixture(page);
  let account = accountFixture;
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: account }));
  const own = { ...shipmentFixture(1), trackingReference: 'MINE-001' };
  const other = { ...shipmentFixture(2), trackingReference: 'TEAM-002' };
  await page.route('**/api/v1/carriers', (route) => route.fulfill({ json: [own.carrier] }));
  await page.route('**/api/v1/sales-reps', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/sales-reps/filter-options', (route) => route.fulfill({ json: [] }));
  const team = [own, other, ...Array.from({ length: 28 }, (_, i) => shipmentFixture(i + 3))];
  const searches: URLSearchParams[] = [];
  await page.route('**/api/v1/shipments/search?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    searches.push(params);
    const rows = params.get('scope') === 'everyone' ? team : [own];
    return route.fulfill({
      json: {
        ...emptyShipments,
        items: rows.slice(
          (Number(params.get('page') ?? 1) - 1) * 25,
          Number(params.get('page') ?? 1) * 25,
        ),
        total: rows.length,
        page: Number(params.get('page') ?? 1),
        tabCounts: { ...emptyShipments.tabCounts, all: rows.length, active: rows.length },
      },
    });
  });
  await page.route('**/api/v1/dashboard/overview?*', (route) => {
    const scope = new URL(route.request().url()).searchParams.get('scope');
    return route.fulfill({
      json: {
        ...emptyOverview,
        counts: {
          ...emptyOverview.counts,
          all: scope === 'everyone' ? 30 : 1,
          active: scope === 'everyone' ? 30 : 1,
        },
      },
    });
  });
  await page.route('**/api/v1/shipments', (route) =>
    route.fulfill({ json: { outcome: 'existing', shipment: other } }),
  );
  await page.route(`**/api/v1/shipments/${other.externalId}`, (route) =>
    route.fulfill({ json: other }),
  );
  await page.route('**/api/v1/shipments/*/history?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, pageSize: 25, total: 0 } }),
  );

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Personal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('link', { name: 'All shipments: 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Team', exact: true }).click();
  await expect(page.getByRole('link', { name: 'All shipments: 30' })).toBeVisible();
  await page.getByRole('link', { name: 'All shipments: 30' }).click();
  await expect(page.getByRole('button', { name: 'Team', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText(other.trackingReference, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Team', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/shipments?tab=all&page=2&q=kept');
  await expect.poll(() => searches.at(-1)?.get('page')).toBe('2');
  await page.getByRole('button', { name: 'Personal', exact: true }).click();
  await expect(page.getByText(other.trackingReference, { exact: true })).toHaveCount(0);
  await expect.poll(() => searches.at(-1)?.get('scope')).toBe('mine');
  await expect.poll(() => searches.at(-1)?.get('page')).toBe('1');
  expect(searches.at(-1)?.get('tab')).toBe('all');
  expect(searches.at(-1)?.get('q')).toBe('kept');
  await page.getByRole('button', { name: 'Personal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Personal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Team', exact: true }).click();
  await expect(page.getByText(other.trackingReference, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Personal', exact: true }).click();
  const form = page.getByRole('form', { name: 'Add shipment' });
  await form.getByLabel('Carrier', { exact: true }).selectOption(own.carrier.externalId);
  await form.getByLabel('Tracking reference', { exact: true }).fill(other.trackingReference);
  await form.getByRole('button', { name: 'Add shipment', exact: true }).click();
  await page.getByRole('button', { name: 'View existing monitoring', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: other.trackingReference, exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to results' }).click();
  await expect(page.getByRole('button', { name: 'Personal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Team', exact: true }).click();

  // A different authenticated account on the same browser starts with its own default.
  account = { ...accountFixture, externalId: '22222222-2222-4222-8222-222222222222' };
  await page.reload();
  await expect(page.getByRole('button', { name: 'Personal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText(other.trackingReference, { exact: true })).toHaveCount(0);
  account = accountFixture;
  await page.reload();
  await expect(page.getByRole('button', { name: 'Team', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `/tmp/monitoring-scope-${page.viewportSize()?.width}.png`,
    fullPage: false,
  });
});
