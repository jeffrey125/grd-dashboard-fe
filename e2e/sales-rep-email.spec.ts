import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

test('Sales Rep email is required, normalized, displayed and editable', async ({ page }) => {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { ...accountFixture, role: 'admin' } }),
  );
  let rep = {
    externalId: '33333333-3333-4333-8333-333333333333',
    firstName: 'Brendan',
    lastName: 'Laird',
    email: 'brendan@globalresourcesdirect.com',
    active: true,
    createdAt: '2026-10-30T00:00:00Z',
    updatedAt: '2026-10-30T00:00:00Z',
    deletedAt: null,
  };
  const submitted: unknown[] = [];
  await page.route('**/api/v1/admin/sales-reps**', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [rep] });
    const input = route.request().postDataJSON();
    submitted.push(input);
    rep = { ...rep, ...input };
    return route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, json: rep });
  });
  await page.goto('/admin/sales-reps');
  await expect(page.getByText(rep.email, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add Sales Rep', exact: true }).click();
  const form = page.getByRole('form', { name: 'Create Sales Rep' });
  await form.getByLabel('First name', { exact: true }).fill('Email');
  await form.getByLabel('Last name', { exact: true }).fill('Fixture');
  await form.getByRole('button', { name: 'Create Sales Rep', exact: true }).click();
  await expect(form.getByText('Enter a valid email.')).toBeVisible();
  expect(submitted).toEqual([]);
  await form.getByRole('textbox', { name: 'Email', exact: true }).fill(' NEW@Example.test ');
  await form.getByRole('button', { name: 'Create Sales Rep', exact: true }).click();
  await expect(form).not.toBeVisible();
  expect(submitted[0]).toEqual({
    firstName: 'Email',
    lastName: 'Fixture',
    email: 'new@example.test',
  });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('form', { name: 'Edit Sales Rep' });
  await expect(editor.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(
    'new@example.test',
  );
  await editor.getByRole('textbox', { name: 'Email', exact: true }).fill('Changed@Example.test');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('changed@example.test', { exact: true })).toBeVisible();
  expect(submitted[1]).toEqual({
    firstName: 'Email',
    lastName: 'Fixture',
    email: 'changed@example.test',
  });
  await expect(page.getByRole('heading', { name: 'Sales Reps', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
