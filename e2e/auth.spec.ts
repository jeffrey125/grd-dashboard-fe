import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { emptyShipments } from '@test/shipment-fixture';
import { installLiveFixture } from './live-fixture';

async function authMock(context: BrowserContext) {
  await installLiveFixture(context);
  const state = {
    account: null as typeof accountFixture | null,
    offlineLogout: false,
    offlineMe: false,
    loginStatus: 200,
    meCalls: 0,
  };
  await context.route('http://localhost:3000/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/shipments/search') return route.fulfill({ json: emptyShipments });
    if (path === '/api/v1/carriers') return route.fulfill({ json: [] });
    if (path === '/api/v1/auth/me') {
      state.meCalls += 1;
      if (state.offlineMe) return route.abort('connectionrefused');
      return route.fulfill({ status: state.account ? 200 : 401, json: state.account ?? {} });
    }
    if (path === '/api/v1/auth/sign-in') {
      const input = route.request().postDataJSON();
      if (state.loginStatus !== 200)
        return route.fulfill({
          status: state.loginStatus,
          headers: { 'Retry-After': '2', 'Access-Control-Expose-Headers': 'Retry-After' },
          json: {},
        });
      if (input.password !== 'fixture password') return route.fulfill({ status: 401, json: {} });
      state.account = {
        ...accountFixture,
        mustChangePassword: input.email === 'restricted@example.test',
      };
      return route.fulfill({ json: state.account });
    }
    if (path === '/api/v1/auth/sign-out') {
      if (state.offlineLogout) return route.abort('connectionrefused');
      state.account = null;
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/v1/auth/change-password') {
      expect(route.request().postDataJSON()).toEqual({
        currentPassword: 'fixture password',
        newPassword: 'new fixture password',
      });
      state.account = null;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}

async function login(page: Page, email = 'staff@example.test', password = 'fixture password') {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function signOut(page: Page) {
  if ((page.viewportSize()?.width ?? 0) < 768)
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
}

test('preserves a safe deep link, rejects bad credentials and restores after reload', async ({
  page,
  context,
}) => {
  await authMock(context);
  await page.goto('/shipments?tab=paused');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await login(page, 'staff@example.test', 'wrong');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' }).first(),
  ).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await login(page);
  await expect(page).toHaveURL(/\/shipments\?tab=paused$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
  await page.goto('/admin/accounts');
  await expect(page.getByText('You do not have permission to view this page.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Accounts' })).toHaveCount(0);
});

test('forces replacement and returns to login after 204', async ({ page, context }) => {
  await authMock(context);
  await page.goto('/shipments?tab=paused');
  await login(page, 'restricted@example.test');
  await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.getByLabel('Current password', { exact: true }).fill('fixture password');
  await page.getByLabel('New password', { exact: true }).fill('new fixture password');
  await page.getByLabel('Confirm new password', { exact: true }).fill('does not match');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByText('The passwords do not match.')).toBeVisible();
  await page.getByLabel('Confirm new password', { exact: true }).fill('new fixture password');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Password changed. Sign in with your new password.')).toBeVisible();
  await expect(page).toHaveURL(/returnTo=%2Fshipments%3Ftab%3Dpaused/);
});

test('locks other tabs, hides protected content on failed logout and retries', async ({
  page,
  context,
}) => {
  const state = await authMock(context);
  state.account = accountFixture;
  await page.goto('/shipments');
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('heading', { name: 'Overview' })).toBeVisible();
  state.offlineLogout = true;
  await signOut(page);
  await expect(page.getByRole('heading', { name: 'Session locked' })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Session locked' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shipments' })).toHaveCount(0);
  await expect(page.getByText(/Sign-out could not be confirmed/)).toBeVisible();
  state.offlineLogout = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await second.close();
});

test('handles initial outages and throttled login without automatic retries or unsafe redirects', async ({
  page,
  context,
}) => {
  const state = await authMock(context);
  state.offlineMe = true;
  await page.goto('/login?returnTo=https%3A%2F%2Fevil.test');
  await expect(page.getByRole('heading', { name: 'Session locked' })).toBeVisible();
  expect(state.meCalls).toBe(1);
  state.offlineMe = false;
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  state.loginStatus = 429;
  await login(page);
  await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled();
  state.loginStatus = 200;
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await login(page);
  await expect(page).toHaveURL('http://127.0.0.1:4174/');
});
