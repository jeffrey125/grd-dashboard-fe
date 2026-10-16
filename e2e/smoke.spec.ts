import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { emptyOverview } from '@test/overview-fixture';
import { emptyShipments } from '@test/shipment-fixture';
import { installLiveFixture } from './live-fixture';

test.beforeEach(async ({ page }) => {
  await installLiveFixture(page);
});

test('built shell supports branding, navigation, themes, and keyboard recovery', async ({
  page,
}) => {
  const errors: string[] = [];
  const unexpectedRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => errors.push(`Request failed: ${request.url()}`));
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.url() === 'http://localhost:3000/api/v1/auth/me') {
      await route.fulfill({ json: accountFixture });
      return;
    }
    if (request.url().includes('/api/v1/shipments/search'))
      return route.fulfill({ json: emptyShipments });
    if (request.url().endsWith('/api/v1/carriers')) return route.fulfill({ json: [] });
    if (request.url().endsWith('/api/v1/sales-reps')) return route.fulfill({ json: [] });
    if (request.url().endsWith('/api/v1/dashboard/overview'))
      return route.fulfill({ json: emptyOverview });
    if (
      new URL(request.url()).origin !== 'http://127.0.0.1:4174' ||
      ['fetch', 'xhr', 'eventsource'].includes(request.resourceType())
    ) {
      unexpectedRequests.push(request.url());
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.addInitScript(() => {
    if (!localStorage.getItem('grd-theme-mode')) localStorage.setItem('grd-theme-mode', 'dark');
  });

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('GRD Dashboard');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-grd-color-scheme', 'dark');

  const logo = page.locator('img[alt="Global Resources Direct"]:visible');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveJSProperty('complete', true);
  expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const logoRatio = await logo.evaluate(
    (image: HTMLImageElement) =>
      image.getBoundingClientRect().width / image.getBoundingClientRect().height,
  );
  const naturalLogoRatio = await logo.evaluate(
    (image: HTMLImageElement) => image.naturalWidth / image.naturalHeight,
  );
  expect(Math.abs(logoRatio - naturalLogoRatio)).toBeLessThan(0.05);

  for (const asset of ['/favicon.svg', '/favicon.ico']) {
    const assetResponse = await page.request.get(asset);
    expect(assetResponse.ok()).toBe(true);
    expect(assetResponse.headers()['content-type']).toMatch(/image\//);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  if ((page.viewportSize()?.width ?? 0) < 768) {
    const menuButton = page.getByRole('button', { name: 'Open navigation' });
    await menuButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await page.getByRole('link', { name: 'Shipments', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  } else {
    await page.getByRole('link', { name: 'Shipments', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
  await expect(
    page.getByText('No shipments match. Change the tab or clear filters.'),
  ).toBeVisible();

  const themeButton = page.getByRole('button', { name: /Choose theme/ });
  await themeButton.click();
  await page.getByRole('menuitem', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-grd-color-scheme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-grd-color-scheme', 'light');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedTransition = await page
    .getByRole('main')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(reducedTransition).toBeLessThanOrEqual(0.00001);

  const deepLink = await page.goto('/missing/nested?source=smoke');
  expect(deepLink?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Page not available' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Page not available' })).toBeVisible();
  await page.keyboard.press('Tab');
  await page.getByRole('link', { name: 'Return home' }).focus();
  await expect(page.getByRole('link', { name: 'Return home' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Page not available' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(unexpectedRequests).toEqual([]);
});

test('follows the system color scheme when no explicit preference exists', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-grd-color-scheme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('grd-theme-mode'))).toBeNull();
});
