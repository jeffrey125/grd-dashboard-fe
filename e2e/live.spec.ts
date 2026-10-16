import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

test('one connection survives navigation and a persistent warning recovers without toasts', async ({
  page,
  context,
}) => {
  await installLiveFixture(context);
  await context.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  for (let i = 0; i < 3; i++) {
    if ((page.viewportSize()?.width ?? 0) < 768)
      await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('link', { name: 'Shipments', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  }
  expect(
    await page.evaluate(() => ({ ...window.liveFixture, emit: undefined, disconnect: undefined })),
  ).toMatchObject({ active: 1, created: 1, peak: 1 });
  await page.evaluate(() => window.liveFixture.disconnect());
  const warning = page.getByRole('status').filter({ hasText: 'data may be stale' });
  await expect(warning).toBeVisible();
  await expect(warning).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.liveFixture.emit('resync'));
  await expect(warning).toHaveCount(0);
  await expect(page.locator('.MuiSnackbar-root')).toHaveCount(0);
});

test('an unavailable auth recheck locks and closes the stream; Retry restores it', async ({
  page,
  context,
}) => {
  await installLiveFixture(context);
  let unavailable = false;
  await context.route('**/api/v1/auth/me', (route) =>
    unavailable ? route.abort('connectionrefused') : route.fulfill({ json: accountFixture }),
  );
  await page.goto('/shipments');
  await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
  unavailable = true;
  await page.evaluate(() => window.liveFixture.disconnect());
  await expect(page.getByRole('heading', { name: 'Session locked' })).toBeVisible();
  expect(await page.evaluate(() => window.liveFixture.active)).toBe(0);
  await expect(page.getByRole('heading', { name: 'Shipments' })).toHaveCount(0);
  unavailable = false;
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
  expect(await page.evaluate(() => window.liveFixture.active)).toBe(1);
});
