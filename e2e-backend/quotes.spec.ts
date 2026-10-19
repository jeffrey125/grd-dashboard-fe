import { expect, test } from '@playwright/test';

test('staff saves, reopens, and copies an immutable comparison through the real API', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('frontend-staff@example.test');
  await page.getByLabel('Password', { exact: true }).fill('staff fixture password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
  await page.goto('/quotes/new');
  await page.getByRole('checkbox', { name: 'myUnishippers', exact: true }).uncheck();
  await page.getByRole('combobox', { name: 'Amazon Shipping sender' }).click();
  await page.getByRole('option', { name: 'Explicit sender' }).click();
  for (const label of ['Amazon Shipping origin', 'Destination']) {
    await page.getByLabel(`${label} name`, { exact: true }).fill('Fixture warehouse');
    await page.getByLabel(`${label} street`, { exact: true }).fill('1 Example Street');
    await page.getByLabel(`${label} city`, { exact: true }).fill('Walworth');
    await page.getByLabel(`${label} state / province`, { exact: true }).fill('WI');
    await page.getByLabel(`${label} postalCode`, { exact: true }).fill('53125');
  }
  for (const [field, value] of Object.entries({
    length: '10.00',
    width: '8',
    height: '6',
    weight: '5',
  }))
    await page.getByLabel(`Group 1 ${field}`, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save comparison', exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  const original = page.url();
  await expect(page.getByText('Saved — no rates run. These details are read-only.')).toBeVisible();
  await expect(page.getByText(/10.00 × 8 × 6 in/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/10.00 × 8 × 6 in/)).toBeVisible();
  await page.getByRole('link', { name: 'Copy to new comparison' }).click();
  await expect(page.getByLabel('Group 1 length', { exact: true })).toHaveValue('10.00');
  await page.getByLabel('Group 1 length', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Save comparison', exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  expect(page.url()).not.toBe(original);
  await page.goto(original);
  await expect(page.getByText(/10.00 × 8 × 6 in/)).toBeVisible();
});
