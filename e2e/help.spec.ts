import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

async function setup(
  page: import('@playwright/test').Page,
  role: 'staff' | 'admin' = 'staff',
  quotes = true,
) {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { ...accountFixture, role } }),
  );
  await page.route('**/api/v1/features', (route) =>
    route.fulfill({ json: { quoteComparisonEnabled: quotes } }),
  );
}

test('staff Help is categorized, searchable, illustrated and accessible on direct links', async ({
  page,
}, testInfo) => {
  await setup(page);
  const adminImages: string[] = [];
  page.on('request', (request) => {
    if (/help\/screenshots\/(accounts|sales-reps)/.test(request.url()))
      adminImages.push(request.url());
  });
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: 'Help', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Help categories' });
  await expect(nav.getByRole('link')).toHaveCount(4);
  await expect(nav.getByRole('link', { name: /Administration/ })).toHaveCount(0);
  const image = page.getByRole('img', { name: /^Read your dashboard/ });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Enlarge screenshot: Read your dashboard' }).click();
  await expect(page.getByRole('dialog', { name: 'Read your dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await nav.getByRole('link', { name: /^Shipments/ }).click();
  await expect(page).toHaveURL(/category=shipments/);
  await page.getByLabel('Search this category').fill('corrected');
  await expect(page.getByRole('heading', { name: 'Update shipment details' })).toBeVisible();
  await expect(
    page.getByText('Carrier and tracking reference cannot be corrected through this editor.'),
  ).toBeVisible();
  await page.getByLabel('Search this category').fill('nothing-matches-this');
  await expect(page.getByText('No guides match your search.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.goto('/help?category=administration');
  await expect(
    page.getByText('This help category is not available for your account.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manage employee accounts' })).toHaveCount(0);
  expect(adminImages).toEqual([]);
  await page.getByRole('link', { name: 'Start here' }).click();
  await expect(page).toHaveURL(/category=getting-started/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/help-${testInfo.project.name}.png`, fullPage: true });
});

test('admins can read Administration guides; all guide screenshots load', async ({ page }) => {
  await setup(page, 'admin');
  for (const category of ['getting-started', 'shipments', 'tracking', 'quotes', 'administration']) {
    await page.goto(`/help?category=${category}`);
    const summaries = page.locator('.MuiAccordionSummary-root');
    await expect(summaries.first()).toBeVisible();
    for (let i = 0; i < (await summaries.count()); i++) {
      const summary = summaries.nth(i);
      if ((await summary.getAttribute('aria-expanded')) !== 'true') await summary.click();
    }
    const images = page.locator('main img');
    expect(await images.count()).toBeGreaterThan(0);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('disabled quote feature and unknown categories have a safe recovery', async ({ page }) => {
  await setup(page, 'staff', false);
  await page.goto('/help?category=quotes');
  await expect(
    page.getByText('This help category is not available for your account.'),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Help categories' })
      .getByRole('link', { name: /Quote Compare/ }),
  ).toHaveCount(0);
  await page.goto('/help?category=unknown');
  await page.getByRole('link', { name: 'Start here' }).click();
  await expect(page.getByRole('heading', { name: 'Getting Started', exact: true })).toBeVisible();
});

test('Help still requires sign-in', async ({ page }) => {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 401 }));
  await page.goto('/help?category=administration');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manage employee accounts' })).toHaveCount(0);
});
