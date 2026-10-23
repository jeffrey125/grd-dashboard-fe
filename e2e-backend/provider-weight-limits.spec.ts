import { expect, test } from '@playwright/test';

const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1`;

test('configured weight limits persist and skip only overweight providers through the real API', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('frontend-admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('admin fixture password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
  await page.goto('/admin/shipping-providers');
  const card = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Amazon Shipping', exact: true }) });
  await expect(card.getByLabel('Maximum weight per box (lb)')).toHaveValue('50');
  await card.getByLabel('Maximum weight per box (lb)').fill('60');
  await expect(card.getByText(/Above the published 50 lb limit/)).toBeVisible();
  const save = page.waitForResponse(
    (response) =>
      response.url().endsWith('/admin/shipping-providers/amazon') &&
      response.request().method() === 'PATCH',
  );
  await card.getByRole('button', { name: 'Save Amazon Shipping settings' }).click();
  expect((await save).status()).toBe(200);
  await page.reload();
  await expect(card.getByLabel('Maximum weight per box (lb)')).toHaveValue('60');
  await card.getByLabel('Maximum weight per box (lb)').fill('50');
  const restore = page.waitForResponse(
    (response) =>
      response.url().endsWith('/admin/shipping-providers/amazon') &&
      response.request().method() === 'PATCH',
  );
  await card.getByRole('button', { name: 'Save Amazon Shipping settings' }).click();
  expect((await restore).status()).toBe(200);
  await page.goto('/quotes/new');
  await expect(
    page.getByRole('heading', { name: '2. Where are you shipping from?' }),
  ).toBeVisible();
  for (const label of ['Sender', 'Recipient']) {
    const manual = page.getByRole('button', { name: `${label}: Enter address manually` });
    if (await manual.isVisible()) await manual.click();
    await page.getByLabel(`${label} company or name`, { exact: false }).fill('Fixture warehouse');
    await page.getByLabel(`${label} address`, { exact: false }).fill('1 Example Street');
    await page.getByLabel(`${label} city`, { exact: false }).fill('Walworth');
    await page.getByRole('combobox', { name: `${label} state / province`, exact: true }).click();
    await page.getByRole('option', { name: 'Wisconsin', exact: true }).click();
    await page.getByLabel(`${label} ZIP / postal code`, { exact: false }).fill('53125');
    await page
      .getByLabel(`${label} contact name (optional)`, { exact: true })
      .fill('Fixture Contact');
    await page.getByLabel(`${label} phone (optional)`, { exact: true }).fill('+1 (202) 555-0147');
  }
  for (const [field, value] of Object.entries({
    length: '10',
    width: '8',
    height: '6',
    weight: '151',
  }))
    await page.getByLabel(`Box type 1: ${field}`, { exact: false }).fill(value);
  await expect(page.getByRole('button', { name: 'Compare quotes', exact: true })).toBeDisabled();
  await expect(page.getByText(/No selected provider can quote every box/)).toBeVisible();
  await page.getByLabel('Box type 1: weight', { exact: false }).fill('60');
  await expect(page.getByText(/Box type 1 exceeds Amazon Shipping/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare quotes', exact: true })).toBeEnabled();
  await page.screenshot({ path: '/tmp/grd-weight-form.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByText(/Box type 1 exceeds Amazon Shipping/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '/tmp/grd-weight-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  const creation = page.waitForResponse(
    (response) =>
      response.url().endsWith('/quote-comparisons') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Compare quotes', exact: true }).click();
  const response = await creation;
  expect(response.status()).toBe(201);
  const result = await response.json();
  expect(result.comparison.attempts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        provider: 'amazon',
        reasonCode: 'weight_limit_exceeded',
        startedAt: null,
      }),
      expect.objectContaining({ provider: 'unishippers', status: 'queued' }),
    ]),
  );
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/exceeds this provider’s 50 lb per-box limit/).first()).toBeVisible();

  // Direct HTTP cannot bypass the all-overweight rule.
  const invalid = result.comparison.input;
  invalid.idempotencyKey = crypto.randomUUID();
  invalid.packageGroups[0].weight = '151';
  const rejected = await page.request.post(`${api}/quote-comparisons`, {
    data: invalid,
    headers: { Origin: 'http://localhost:4175' },
  });
  expect(rejected.status()).toBe(400);
});
