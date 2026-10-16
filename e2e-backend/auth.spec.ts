import { expect, type Page, test } from '@playwright/test';

const apiOrigin = 'http://localhost:3000';
const api = `${apiOrigin}/api/v1`;
const origin = 'http://localhost:4175';
async function login(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('real cookie/CORS login, restoration, roles, replacement, revocation and logout', async ({
  page,
  context,
  browser,
}) => {
  expect((await context.request.get(`${api}/health/live`)).status()).toBe(200);
  expect((await context.request.get(`${apiOrigin}/health/live`)).status()).toBe(404);
  expect((await context.request.get(`${apiOrigin}/auth/me`)).status()).toBe(404);
  await page.goto('/shipments');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await login(page, 'frontend-staff@example.test', 'wrong');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' }).first(),
  ).toBeVisible();
  const signInResponse = page.waitForResponse(`${api}/auth/sign-in`);
  await login(page, 'frontend-staff@example.test', 'staff fixture password');
  const response = await signInResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()['access-control-allow-origin']).toBe(origin);
  expect(response.headers()['access-control-allow-credentials']).toBe('true');
  await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
  const cookies = await context.cookies(api);
  expect(cookies.some((cookie) => cookie.httpOnly && cookie.sameSite === 'Lax')).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('session_token');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
  await page.goto('/admin/accounts');
  await expect(page.getByText('You do not have permission to view this page.')).toBeVisible();
  expect(
    await page.evaluate(
      async (url) => (await fetch(`${url}/admin/accounts`, { credentials: 'include' })).status,
      api,
    ),
  ).toBe(403);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect((await context.request.get(`${api}/auth/me`)).status()).toBe(401);

  const restrictedContext = await browser.newContext();
  const restricted = await restrictedContext.newPage();
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  try {
    await restricted.goto(`${origin}/shipments`);
    await login(restricted, 'frontend-restricted@example.test', 'issued fixture password');
    await expect(restricted.getByRole('heading', { name: 'Change password' })).toBeVisible();
    await restricted.getByLabel('Current password', { exact: true }).fill('wrong');
    await restricted
      .getByLabel('New password', { exact: true })
      .fill('replacement fixture password');
    await restricted
      .getByLabel('Confirm new password', { exact: true })
      .fill('replacement fixture password');
    await restricted.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(
      restricted.getByRole('alert').filter({ hasText: 'Check the submitted information' }).first(),
    ).toBeVisible();
    await restricted
      .getByLabel('Current password', { exact: true })
      .fill('issued fixture password');
    await restricted
      .getByLabel('New password', { exact: true })
      .fill('replacement fixture password');
    await restricted
      .getByLabel('Confirm new password', { exact: true })
      .fill('replacement fixture password');
    const changed = restricted.waitForResponse(`${api}/auth/change-password`);
    await restricted.getByRole('button', { name: 'Change password', exact: true }).click();
    expect((await changed).status()).toBe(204);
    await expect(restricted.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect((await restrictedContext.request.get(`${api}/auth/me`)).status()).toBe(401);
    await login(restricted, 'frontend-restricted@example.test', 'replacement fixture password');
    await expect(restricted.getByRole('heading', { name: 'Shipments' })).toBeVisible();
    const profile = await (await restrictedContext.request.get(`${api}/auth/me`)).json();

    await admin.goto(origin);
    await login(admin, 'frontend-admin@example.test', 'admin fixture password');
    await expect(admin.getByRole('link', { name: 'Accounts', exact: true })).toBeVisible();
    const adminProfile = await (await adminContext.request.get(`${api}/auth/me`)).json();
    const conflict = await adminContext.request.patch(
      `${api}/admin/accounts/${adminProfile.externalId}`,
      { headers: { Origin: origin }, data: { role: 'staff' } },
    );
    expect(conflict.status()).toBe(409);
    const reset = await adminContext.request.post(
      `${api}/admin/accounts/${profile.externalId}/password`,
      { headers: { Origin: origin }, data: { password: 'reset fixture password' } },
    );
    expect(reset.status()).toBe(204);
    // Restoration is an authoritative session read after server-side revocation.
    await restricted.reload();
    await expect(restricted.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(restricted.getByRole('heading', { name: 'Shipments' })).toHaveCount(0);
  } finally {
    await restrictedContext.close();
    await adminContext.close();
  }
});

test('Vite preserves /api/v1 for real cookie login, restoration and logout', async ({
  page,
  context,
}) => {
  const devOrigin = 'http://localhost:4176';
  const authRequests: string[] = [];
  page.on('request', (request) => {
    if (
      ['fetch', 'xhr'].includes(request.resourceType()) &&
      new URL(request.url()).pathname.includes('/auth/')
    )
      authRequests.push(request.url());
  });
  await page.goto(`${devOrigin}/shipments`);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  const signedIn = page.waitForResponse(`${devOrigin}/api/v1/auth/sign-in`);
  await login(page, 'frontend-staff@example.test', 'staff fixture password');
  expect((await signedIn).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
  expect(
    (await context.cookies(devOrigin)).some(
      (cookie) => cookie.httpOnly && cookie.sameSite === 'Lax',
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible();
  const signedOut = page.waitForResponse(`${devOrigin}/api/v1/auth/sign-out`);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  expect((await signedOut).status()).toBe(204);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect((await context.request.get(`${devOrigin}/api/v1/auth/me`)).status()).toBe(401);
  expect(authRequests.length).toBeGreaterThan(3);
  expect(authRequests.every((url) => url.startsWith(`${devOrigin}/api/v1/auth/`))).toBe(true);
  expect(authRequests.some((url) => /get-session|sign-in\/email/.test(url))).toBe(false);
});
