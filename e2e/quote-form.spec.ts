import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

test('guides staff to missing quote fields and retains entries on desktop and mobile', async ({
  page,
}, testInfo) => {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  await page.route('**/api/v1/quote-comparisons/providers', (route) =>
    route.fulfill({
      json: [
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
    }),
  );
  let submissions = 0;
  await page.route('**/api/v1/quote-comparisons', (route) => {
    submissions += 1;
    return route.fulfill({ status: 500, json: {} });
  });
  await page.goto('/quotes/new');
  await expect(
    page.getByRole('heading', { name: '1. Choose your shipping services' }),
  ).toBeVisible();
  await expect(page.getByText(/Mode: request/)).toHaveCount(0);
  await page.getByLabel('Recipient company or name', { exact: false }).fill('Test recipient');
  await page.getByRole('button', { name: 'Compare quotes', exact: true }).click();
  await expect(
    page.getByText('Please complete or correct the highlighted fields before comparing quotes.'),
  ).toBeVisible();
  const sender = page.getByLabel('Sender company or name', { exact: false });
  await expect(sender).toBeFocused();
  await expect(sender).toHaveAttribute('aria-invalid', 'true');
  await expect(sender).toHaveAccessibleDescription('This field is required');
  await expect(page.getByLabel('Recipient company or name', { exact: false })).toHaveValue(
    'Test recipient',
  );
  expect(submissions).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('quote-errors.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await sender.fill('Test sender');
  await expect(sender).toHaveAttribute('aria-invalid', 'false');
  const weight = page.getByLabel('Box type 1: weight (lb)', { exact: false });
  await expect(weight).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Box type 1: length (in)', { exact: false }).fill('10');
  await page.getByRole('button', { name: 'Compare quotes', exact: true }).click();
  await expect(page.getByLabel('Box type 1: width (in)', { exact: false })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByLabel('Box type 1: height (in)', { exact: false })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(submissions).toBe(0);
});
