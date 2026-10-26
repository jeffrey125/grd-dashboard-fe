import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

test('disabled comparison hides navigation and blocks direct quote pages without quote requests', async ({
  page,
}) => {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { ...accountFixture, role: 'admin' } }),
  );
  await page.route('**/api/v1/features', (route) =>
    route.fulfill({ json: { quoteComparisonEnabled: false } }),
  );
  const quoteRequests: string[] = [];
  await page.route(/\/api\/v1\/(quote-comparisons|admin\/shipping-providers)/, (route) => {
    quoteRequests.push(route.request().url());
    return route.fulfill({ status: 404, json: {} });
  });

  await page.goto('/shipments');
  await expect(page.getByRole('heading', { name: 'Shipments', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quote Compare' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Quote providers' })).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) < 900)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('link', { name: 'Monitoring' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Accounts' }).first()).toBeVisible();

  for (const path of [
    '/quotes',
    '/quotes/new',
    '/quotes/00000000-0000-4000-8000-000000000001',
    '/admin/shipping-providers',
  ]) {
    await page.goto(path);
    await expect(
      page.getByText('This page is not available in the current dashboard.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quote Compare' })).toHaveCount(0);
  }
  expect(quoteRequests).toEqual([]);
});

test('feature metadata failure hides quote tools while tracking stays available', async ({
  page,
}) => {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  await page.route('**/api/v1/features', (route) => route.fulfill({ json: { unexpected: true } }));
  await page.goto('/shipments');
  await expect(page.getByRole('heading', { name: 'Shipments', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quote Compare' })).toHaveCount(0);
  await page.goto('/quotes/new');
  await expect(
    page.getByText('This page is not available in the current dashboard.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});
