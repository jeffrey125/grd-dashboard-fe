import { expect, test } from '@playwright/test';

test('built app loads assets, supports deep links, and recovers with keyboard navigation', async ({
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

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('GRD Dashboard');
  await expect(page.getByRole('heading', { name: 'GRD Dashboard' })).toBeVisible();
  const logo = page.getByRole('img', { name: 'Global Resources Direct' });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveJSProperty('complete', true);
  expect(await logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  for (const asset of ['/favicon.svg', '/favicon.ico']) {
    const assetResponse = await page.request.get(asset);
    expect(assetResponse.ok()).toBe(true);
    expect(assetResponse.headers()['content-type']).toMatch(/image\//);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const deepLink = await page.goto('/missing/nested?source=smoke');
  expect(deepLink?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Page not available' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Page not available' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Return home' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'GRD Dashboard' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Page not available' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(unexpectedRequests).toEqual([]);
});
