import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

test('reports signed-in failures without private values or recursive reporting', async ({
  page,
}) => {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  const events: Record<string, unknown>[] = [];
  await page.route('**/api/v1/telemetry/frontend', (route) => {
    events.push(route.request().postDataJSON());
    return route.fulfill({ status: 503 });
  });
  await page.route('**/api/v1/dashboard/overview', (route) =>
    route.fulfill({
      status: 503,
      headers: {
        'x-request-id': '11111111-1111-4111-8111-111111111111',
        'access-control-expose-headers': 'x-request-id',
      },
      json: { secret: 'payload-canary' },
    }),
  );
  await page.goto('/');
  await expect.poll(() => events.some((event) => event.kind === 'api')).toBe(true);
  await page.evaluate(() => {
    const error = new TypeError('private-message-canary');
    window.dispatchEvent(new ErrorEvent('error', { error }));
    window.dispatchEvent(new ErrorEvent('error', { error }));
  });
  await expect.poll(() => events.filter((event) => event.kind === 'browser').length).toBe(1);
  expect(JSON.stringify(events)).not.toContain('canary');
  expect(events.find((event) => event.kind === 'api')?.failedRequestId).toBe(
    '11111111-1111-4111-8111-111111111111',
  );
  expect(events.length).toBeLessThanOrEqual(3);
});

test('does not report login-page errors', async ({ page }) => {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 401 }));
  const reports: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/telemetry/frontend')) reports.push(request.url());
  });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('anonymous') })),
  );
  await page.waitForTimeout(150);
  expect(reports).toEqual([]);
});
