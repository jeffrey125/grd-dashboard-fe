import { expect, type Page, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

const admin = {
  ...accountFixture,
  firstName: 'Avery',
  lastName: 'Admin',
  email: 'admin@example.test',
  role: 'admin' as const,
};
const employee = {
  ...accountFixture,
  externalId: '22222222-2222-4222-8222-222222222222',
  firstName: 'Casey',
  lastName: 'Employee',
};
async function setup(page: Page) {
  await installLiveFixture(page);
  const state = {
    actor: { ...admin },
    row: { ...employee },
    createCount: 0,
    resetCount: 0,
    patches: [] as Record<string, unknown>[],
    status: 200,
    conflict: '',
    revoked: false,
    reads: 0,
  };
  await page.route('**/api/v1/auth/me', (route) =>
    state.revoked ? route.fulfill({ status: 401, json: {} }) : route.fulfill({ json: state.actor }),
  );
  await page.route('**/api/v1/admin/accounts**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      state.reads++;
      if (state.status !== 200) return route.fulfill({ status: state.status, json: {} });
      const path = new URL(request.url()).pathname;
      return route.fulfill({
        json: path.endsWith('/accounts')
          ? [state.actor, state.row]
          : path.endsWith(admin.externalId)
            ? state.actor
            : state.row,
      });
    }
    if (request.method() === 'PATCH') {
      state.patches.push(request.postDataJSON());
      if (state.conflict) return route.fulfill({ status: 409, json: { message: state.conflict } });
      if (state.status !== 200)
        return route.fulfill({
          status: state.status,
          json: { message: 'private server diagnostic' },
        });
      if (request.url().endsWith(admin.externalId)) {
        Object.assign(state.actor, request.postDataJSON());
        return route.fulfill({ json: state.actor });
      }
      Object.assign(state.row, request.postDataJSON());
      return route.fulfill({ json: state.row });
    }
    if (request.url().endsWith('/password')) {
      state.resetCount++;
      state.row.mustChangePassword = true;
      return route.fulfill({ status: 204 });
    }
    state.createCount++;
    if (state.conflict) return route.fulfill({ status: 409, json: { message: state.conflict } });
    const { password: _password, ...fields } = request.postDataJSON();
    Object.assign(state.row, fields, { mustChangePassword: true });
    return route.fulfill({ status: 201, json: state.row });
  });
  return state;
}
async function openDetail(page: Page) {
  await page.goto(`/admin/accounts/${employee.externalId}`);
  await expect(page.getByRole('button', { name: 'Edit account' })).toBeVisible();
}

test('Admin list, search, mobile cards, details and both themes', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/accounts');
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  await page.getByLabel('Search accounts').fill('Casey');
  await expect(page.getByRole('link', { name: 'Casey Employee', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Avery Admin', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Casey Employee', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Profile', exact: true })).toContainText(
    employee.email,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `/tmp/grd-accounts-detail-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({
    path: `/tmp/grd-accounts-dark-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
});

test('name edits preserve failures and drafts, omit email, and require confirmation for role', async ({
  page,
}) => {
  const state = await setup(page);
  await openDetail(page);
  await page.getByRole('button', { name: 'Edit account', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeDisabled();
  await page.getByLabel('First name', { exact: true }).fill('A new name');
  const reads = state.reads;
  state.row.lastName = 'Changed elsewhere';
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    Reflect.deleteProperty(document, 'visibilityState');
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  });
  await expect.poll(() => state.reads).toBeGreaterThan(reads);
  await expect(page.getByLabel('Last name', { exact: true })).toHaveValue('Employee');
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('A new name');
  await page.getByRole('link', { name: 'Back to accounts' }).click();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  state.status = 500;
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('form', { name: 'Edit account' }).getByRole('alert')).toContainText(
    'could not complete',
  );
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('A new name');
  state.status = 200;
  await page.getByLabel('Role', { exact: true }).selectOption('admin');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Confirm role change' });
  await expect(confirmation).toContainText(employee.email);
  await expect(confirmation).toContainText('signed out');
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.patches).toHaveLength(1);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await confirmation.getByRole('button', { name: 'Confirm role change' }).click();
  await expect(page.getByRole('button', { name: 'Edit account', exact: true })).toBeVisible();
  expect(state.patches).toEqual([
    { firstName: 'A new name' },
    { firstName: 'A new name', role: 'admin' },
  ]);
  expect(state.row.lastName).toBe('Changed elsewhere');
});

test('activation, reset and protected-admin conflicts are explicit; cancelling never submits', async ({
  page,
}) => {
  const state = await setup(page);
  await openDetail(page);
  await page.getByRole('button', { name: 'Deactivate account', exact: true }).click();
  const activation = page.getByRole('dialog', { name: 'Deactivate account?' });
  await expect(activation).toContainText(employee.email);
  await activation.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.patches).toHaveLength(0);
  state.conflict = 'At least one active administrator is required';
  await page.getByRole('button', { name: 'Deactivate account', exact: true }).click();
  await activation.getByRole('button', { name: 'Confirm deactivation' }).click();
  await expect(activation.getByRole('alert')).toContainText('At least one active Admin');
  state.conflict = '';
  await activation.getByRole('button', { name: 'Confirm deactivation' }).click();
  await expect(page.getByRole('button', { name: 'Activate account', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  const reset = page.getByRole('dialog', { name: 'Reset password', exact: true });
  await reset.getByLabel('Issued password', { exact: true }).fill('a private issued password');
  await reset
    .getByLabel('Confirm issued password', { exact: true })
    .fill('a private issued password');
  await reset.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.resetCount).toBe(0);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(reset.getByLabel('Issued password', { exact: true })).toHaveValue('');
  await reset.getByLabel('Issued password', { exact: true }).fill('a private issued password');
  await reset
    .getByLabel('Confirm issued password', { exact: true })
    .fill('a private issued password');
  await reset.getByRole('button', { name: 'Confirm password reset' }).click();
  await expect(reset).toBeHidden();
  expect(state.resetCount).toBe(1);
  await expect(page.getByRole('region', { name: 'Profile', exact: true })).toContainText(
    'Required at next sign-in',
  );
  expect(await page.locator('body').innerText()).not.toContain('a private issued password');
  expect(
    await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    ),
  ).not.toContain('a private issued password');
});

test('creation validates and retains duplicate-email forms without disclosing passwords', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/admin/accounts/new');
  const form = page.getByRole('form', { name: 'Create account' });
  await form.getByRole('button', { name: 'Create account' }).click();
  expect(state.createCount).toBe(0);
  await form.getByLabel('First name', { exact: true }).fill(' New ');
  await form.getByLabel('Last name', { exact: true }).fill(' Employee ');
  await form.getByLabel('Email', { exact: true }).fill(' NEW@example.test ');
  await form.getByLabel('Issued password', { exact: true }).fill('private issued password');
  await form.getByLabel('Confirm issued password', { exact: true }).fill('private issued password');
  state.conflict = 'Email already exists';
  await form.getByRole('button', { name: 'Create account' }).click();
  await expect(form.getByText('An account already uses this email address.').first()).toBeVisible();
  await expect(form.getByLabel('First name', { exact: true })).toHaveValue(' New ');
  state.conflict = '';
  await form.getByLabel('Email', { exact: true }).fill(' DIFFERENT@example.test ');
  await form.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible();
  expect(state.row.email).toBe('different@example.test');
  expect(state.row.role).toBe('staff');
  expect(page.url()).not.toContain('password');
  expect(await page.locator('body').innerText()).not.toContain('private issued password');
});

test('self restrictions, Better Auth profile refresh and stale-session denial', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(`/admin/accounts/${admin.externalId}`);
  await expect(page.getByRole('button', { name: 'Deactivate account' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Change my password' })).toHaveAttribute(
    'href',
    '/change-password',
  );
  await page.getByRole('button', { name: 'Edit account' }).click();
  await expect(page.getByLabel('Role', { exact: true })).toBeDisabled();
  await page.getByLabel('First name', { exact: true }).fill('Updated');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit account' })).toBeVisible();
  await expect(page.getByText('Updated Admin', { exact: true }).first()).toHaveText(
    'Updated Admin',
  );
  await page.getByRole('button', { name: 'Edit account' }).click();
  await page.getByLabel('Last name', { exact: true }).fill('Private draft');
  state.status = 403;
  state.revoked = true;
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByText('Private draft')).toHaveCount(0);
});

test('Staff cannot fetch Admin data through direct URLs; invalid UUIDs and 404s are safe', async ({
  page,
}) => {
  const state = await setup(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  for (const path of [
    '/admin/accounts',
    '/admin/accounts/new',
    `/admin/accounts/${employee.externalId}`,
  ]) {
    await page.goto(path);
    await expect(page.getByText('You do not have permission to view this page.')).toBeVisible();
  }
  expect(state.reads).toBe(0);
  await page.unroute('**/api/v1/auth/me');
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: admin }));
  await page.goto('/admin/accounts/not-a-uuid');
  await expect(page.getByRole('heading', { name: 'Page not available' })).toBeVisible();
  expect(state.reads).toBe(0);
  state.status = 404;
  await page.goto(`/admin/accounts/${employee.externalId}`);
  await expect(page.getByRole('alert').filter({ hasText: 'not available' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit account' })).toHaveCount(0);
});
