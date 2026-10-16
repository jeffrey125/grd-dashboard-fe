import { expect, type Page, test } from '@playwright/test';

const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1`;
const origin = 'http://localhost:4175';
const headers = { Origin: origin };
async function login(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function replacePassword(page: Page, current: string, replacement: string) {
  await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
  await page.getByLabel('Current password', { exact: true }).fill(current);
  await page.getByLabel('New password', { exact: true }).fill(replacement);
  await page.getByLabel('Confirm new password', { exact: true }).fill(replacement);
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
}

test('real Admin create/edit/duplicate, Staff guard, role/deactivation/reset revocation and replacement', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120_000);
  const email = 'account-management@example.test';
  await page.goto('/admin/accounts/new');
  await login(page, 'frontend-accounts-primary-admin@example.test', 'admin fixture password');
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  const form = page.getByRole('form', { name: 'Create account' });
  await form.getByLabel('First name', { exact: true }).fill('Management');
  await form.getByLabel('Last name', { exact: true }).fill('Employee');
  await form.getByLabel('Email', { exact: true }).fill(' ACCOUNT-MANAGEMENT@example.test ');
  await form.getByLabel('Issued password', { exact: true }).fill('issued employee password');
  await form
    .getByLabel('Confirm issued password', { exact: true })
    .fill('issued employee password');
  await form.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').at(-1);
  await expect(page.getByRole('region', { name: 'Profile', exact: true })).toContainText(
    'Required at next sign-in',
  );
  await page.getByRole('button', { name: 'Edit account' }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeDisabled();
  await page.getByLabel('First name', { exact: true }).fill('Edited');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit account' })).toBeVisible();
  expect(await (await context.request.get(`${api}/admin/accounts/${id}`)).json()).toMatchObject({
    firstName: 'Edited',
    email,
    role: 'staff',
  });
  await page.goto('/admin/accounts/new');
  await form.getByLabel('First name', { exact: true }).fill('Duplicate');
  await form.getByLabel('Last name', { exact: true }).fill('Employee');
  await form.getByLabel('Email', { exact: true }).fill(email);
  await form.getByLabel('Issued password', { exact: true }).fill('another issued password');
  await form.getByLabel('Confirm issued password', { exact: true }).fill('another issued password');
  await form.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(form.getByText('An account already uses this email address.').first()).toBeVisible();
  await form.getByRole('link', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();

  const employeeContext = await browser.newContext();
  const employeePage = await employeeContext.newPage();
  try {
    await employeePage.goto(`${origin}/admin/accounts`);
    await login(employeePage, email, 'issued employee password');
    await replacePassword(employeePage, 'issued employee password', 'employee chosen password');
    expect((await employeeContext.request.get(`${api}/auth/me`)).status()).toBe(401);
    await login(employeePage, email, 'employee chosen password');
    await expect(
      employeePage.getByText('You do not have permission to view this page.'),
    ).toBeVisible();
    expect((await employeeContext.request.get(`${api}/admin/accounts`)).status()).toBe(403);
    expect(
      (
        await employeeContext.request.patch(`${api}/admin/accounts/${id}`, {
          headers,
          data: { role: 'admin' },
        })
      ).status(),
    ).toBe(403);
    for (const path of ['/admin/accounts/new', `/admin/accounts/${id}`]) {
      await employeePage.goto(`${origin}${path}`);
      await expect(
        employeePage.getByText('You do not have permission to view this page.'),
      ).toBeVisible();
    }
    await page.goto(`/admin/accounts/${id}`);
    await page.getByRole('button', { name: 'Edit account' }).click();
    await page.getByLabel('Role', { exact: true }).selectOption('admin');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page
      .getByRole('dialog', { name: 'Confirm role change' })
      .getByRole('button', { name: 'Confirm role change' })
      .click();
    await expect(page.getByRole('button', { name: 'Edit account' })).toBeVisible();
    expect((await employeeContext.request.get(`${api}/auth/me`)).status()).toBe(401);
    await employeePage.reload();
    await login(employeePage, email, 'employee chosen password');
    await expect(employeePage.getByRole('heading', { name: 'Account details' })).toBeVisible();
    await page.getByRole('button', { name: 'Deactivate account' }).click();
    await page.getByRole('button', { name: 'Confirm deactivation' }).click();
    await expect(page.getByRole('button', { name: 'Activate account' })).toBeVisible();
    expect((await employeeContext.request.get(`${api}/auth/me`)).status()).toBe(401);
    await page.getByRole('button', { name: 'Activate account' }).click();
    await page.getByRole('button', { name: 'Confirm activation' }).click();
    await expect(page.getByRole('button', { name: 'Deactivate account' })).toBeVisible();
    await employeePage.reload();
    await login(employeePage, email, 'employee chosen password');
    await expect(employeePage.getByRole('heading', { name: 'Account details' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset password', exact: true }).click();
    const reset = page.getByRole('dialog', { name: 'Reset password', exact: true });
    await reset.getByLabel('Issued password', { exact: true }).fill('reset issued password');
    await reset
      .getByLabel('Confirm issued password', { exact: true })
      .fill('reset issued password');
    await reset.getByRole('button', { name: 'Confirm password reset' }).click();
    await expect(reset).toBeHidden();
    expect((await employeeContext.request.get(`${api}/auth/me`)).status()).toBe(401);
    await employeePage.reload();
    await login(employeePage, email, 'reset issued password');
    await replacePassword(employeePage, 'reset issued password', 'final employee password');
    expect((await employeeContext.request.get(`${api}/auth/me`)).status()).toBe(401);
    expect(await page.locator('body').innerText()).not.toContain('reset issued password');
  } finally {
    await employeeContext.close();
  }
});

test('real own-name changes refresh Better Auth, protected self changes conflict, own password uses existing flow', async ({
  page,
  context,
}) => {
  await page.goto('/admin/accounts');
  await login(page, 'frontend-accounts-self-admin@example.test', 'admin fixture password');
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  const actor = await (await context.request.get(`${api}/auth/me`)).json();
  await page.goto(`/admin/accounts/${actor.externalId}`);
  await expect(page.getByRole('button', { name: 'Deactivate account' })).toBeDisabled();
  await page.getByRole('button', { name: 'Edit account' }).click();
  await expect(page.getByLabel('Role', { exact: true })).toBeDisabled();
  await page.getByLabel('First name', { exact: true }).fill('Renamed');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit account' })).toBeVisible();
  await expect(page.getByText('Renamed Admin', { exact: true }).first()).toBeVisible();
  for (const data of [{ role: 'staff' }, { active: false }])
    expect(
      (
        await context.request.patch(`${api}/admin/accounts/${actor.externalId}`, { headers, data })
      ).status(),
    ).toBe(409);
  await page.getByRole('link', { name: 'Change my password' }).click();
  await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Changing your password' })).toContainText(
    'signs you out of all sessions',
  );
});
