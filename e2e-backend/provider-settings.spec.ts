import { expect, type Page, test } from '@playwright/test';

async function signIn(page: Page, role: 'admin' | 'staff') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`frontend-${role}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(`${role} fixture password`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
}

test('admins test, acknowledge, save and refresh defaults; staff see effective maintenance', async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.FE_TEST_PROVIDER_ADMIN !== 'true',
    'Isolated provider-admin fixture required',
  );
  await signIn(page, 'admin');
  await page.goto('/admin/shipping-providers');
  const card = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Amazon Shipping', exact: true }) });
  await expect(card.getByLabel('Stale period (hours)')).toHaveValue('1');
  await card.getByRole('button', { name: 'Refresh Amazon Shipping default' }).click();
  await expect(card.getByText(/Fixture warehouse.*Retrieved/)).toBeVisible();
  await card.getByRole('combobox', { name: 'Execution mode' }).click();
  await page.getByRole('option', { name: 'Browser', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Save Amazon Shipping settings' })).toBeDisabled();
  await card.getByRole('button', { name: 'Test browser readiness' }).click();
  await expect(card.getByText(/Connection test failed/)).toBeVisible({ timeout: 15000 });
  await card.getByRole('checkbox', { name: /I acknowledge/ }).check();
  await card.getByRole('button', { name: 'Save Amazon Shipping settings' }).click();
  await expect(card.getByText(/This configuration was saved after a failed/)).toBeVisible();
  await page.reload();
  await expect(card.getByText(/This configuration was saved after a failed/)).toBeVisible();
  await card.getByLabel('Maintenance message').fill('Fixture maintenance');
  await card.getByRole('checkbox', { name: 'Provider enabled', exact: true }).uncheck();
  await card.getByRole('button', { name: 'Save Amazon Shipping settings' }).click();
  await expect(
    card.getByRole('button', { name: 'Refresh Amazon Shipping default' }),
  ).toBeDisabled();

  const staffContext = await browser.newContext({ baseURL: 'http://localhost:4175' });
  try {
    const staff = await staffContext.newPage();
    await signIn(staff, 'staff');
    await expect(staff.getByRole('link', { name: 'Quote providers', exact: true })).toHaveCount(0);
    await staff.goto('/admin/shipping-providers');
    await expect(staff.getByText('You do not have permission to view this page.')).toBeVisible();
    await staff.goto('/quotes/new');
    await expect(staff.getByText(/Amazon Shipping is disabled. Fixture maintenance/)).toBeVisible();
    await expect(staff.getByRole('checkbox', { name: 'Amazon Shipping', exact: true })).toHaveCount(
      0,
    );
    await expect(staff.getByText(/Fixture warehouse.*Retrieved/)).toBeVisible();
  } finally {
    await staffContext.close();
  }
});
