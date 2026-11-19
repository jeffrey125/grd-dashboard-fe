import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installUpcomingFixture, repA, repB, upcomingReps } from './upcoming-fixture';

test.use({ timezoneId: 'America/Chicago' });

test('monthly date opens all orders, with mobile modal and same desktop drawer', async ({
  page,
}, testInfo) => {
  await installUpcomingFixture(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/upcoming-shipments');
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
  await expect(page.getByRole('button', { name: /next month/i })).toHaveCount(0);
  const mobile = testInfo.project.name.includes('mobile');
  const panel = page.getByRole('dialog');
  if (mobile) {
    await page.getByRole('button', { name: '2026-11-16, 25 orders', exact: true }).click();
  } else {
    await page.locator('td[data-date="2026-11-16"]').getByText('+22 more', { exact: true }).click();
    await expect(panel).toHaveAccessibleName('Monday, Nov 16');
  }
  await expect(page.locator('[data-order-id]')).toHaveCount(25);
  await page.locator('[data-order-id]').first().click();
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Warehouse stock', { exact: false })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const bounds = await panel.boundingBox();
  const viewport = page.viewportSize();
  if (!bounds || !viewport) throw new Error('Missing overlay bounds');
  if (mobile) {
    expect(bounds.x).toBeGreaterThan(0);
    expect(bounds.width).toBeLessThan(viewport.width);
  } else {
    expect(Math.round(bounds.x + bounds.width)).toBe(viewport.width);
    await panel.getByRole('button', { name: 'Back to orders', exact: false }).click();
    await expect(panel.locator('[data-order-id]')).toHaveCount(25);
    await expect(panel.locator('[data-order-id]').first()).toBeFocused();
  }
  await page.screenshot({ path: `/tmp/upcoming-${testInfo.project.name}.png`, fullPage: true });
  await page.mouse.click(3, 100);
  await expect(panel).toBeHidden();
  if (!mobile)
    await page.getByRole('button', { name: '2026-11-16, 25 orders', exact: true }).click();
  await page.locator('[data-order-id]').first().click();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('combobox', { name: 'Sales rep' }).click();
  await expect(page.getByRole('option')).toHaveText(['All permitted reps', 'Taylor']);
  await page.getByRole('option', { name: 'Taylor', exact: true }).click();
  await expect(page.getByText(/^13 orders ·/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('calendar and order details show a PO linked to a different product', async ({
  page,
}, testInfo) => {
  await installUpcomingFixture(page);
  await page.goto('/upcoming-shipments');
  if (!testInfo.project.name.includes('mobile')) {
    await expect(page.getByText('PO# 0, 90002', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: '2026-11-16, 25 orders', exact: true }).click();
  await page.locator('[data-order-id="rec00000000000001"]').click();
  const panel = page.getByRole('dialog', { name: 'Order details' });
  await expect(panel.getByText('GRD PO: 0 · Warehouse stock')).toBeVisible();
  await expect(panel.getByText('Linked rye flour · Example Mill · GRD PO: 90002')).toBeVisible();
});

test('overview shows first five, date selection, and stale warning; unassigned staff hidden', async ({
  page,
}) => {
  await installUpcomingFixture(page, { stale: true });
  await page.goto('/');
  const section = page.getByRole('region', { name: 'Upcoming shipments this week' });
  await expect(section.getByRole('button', { name: /Tue Nov 17/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(section.getByText('No upcoming shipments for this date.')).toBeVisible();
  await section.getByRole('button', { name: 'All dates' }).click();
  await expect(section.getByText('Showing 5 of 25 orders')).toBeVisible();
  await expect(section.locator('[data-order-id]')).toHaveCount(5);
  await expect(section.getByText(/Showing the last successful data/)).toBeVisible();
  await section.getByRole('combobox', { name: 'Sales rep' }).click();
  await page.getByRole('option', { name: 'Taylor', exact: true }).click();
  await expect(section.getByText('Showing 5 of 13 orders')).toBeVisible();
  const filledHeight = await section.evaluate((element) => element.getBoundingClientRect().height);
  await section.getByRole('button', { name: /Mon Nov 16/ }).click();
  await expect(section.getByText('Showing 5 of 13 orders')).toBeVisible();
  await section.getByRole('button', { name: /Tue Nov 17/ }).click();
  await expect(section.getByText('No upcoming shipments for this date.')).toBeVisible();
  const emptyHeight = await section.evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(emptyHeight - filledHeight)).toBeLessThan(1);
  await installUpcomingFixture(page, { enabled: false });
  await page.reload();
  await expect(section).toHaveCount(0);
});

test('admin dispatch and explicit account assignment save', async ({ page }, testInfo) => {
  await installUpcomingFixture(page, { admin: true });
  await page.goto('/admin/upcoming-shipments');
  await expect(page.getByRole('heading', { name: 'Shipment dispatch', exact: true })).toBeVisible();
  if (testInfo.project.name.includes('mobile'))
    await expect(page.getByText('Taylor Example · 13', { exact: true })).toBeVisible();
  else await expect(page.getByLabel('Shipment dates')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Example Foods 2 SO-/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Sales rep' }).click();
  await expect(page.getByRole('option')).toHaveText(['All permitted reps', 'Taylor', 'Unassigned']);
  await page.getByRole('option', { name: 'Unassigned', exact: true }).click();
  const accountId = accountFixture.externalId;
  let saved: unknown;
  await page.route(`**/api/v1/admin/accounts/${accountId}`, (route) =>
    route.fulfill({ json: { ...accountFixture, role: 'staff' } }),
  );
  await page.route(`**/api/v1/admin/accounts/${accountId}/upcoming-shipments`, (route) => {
    if (route.request().method() === 'PATCH') {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: saved });
    }
    return route.fulfill({
      json: {
        configured: true,
        ownRepId: null,
        assignedRepIds: [],
        reps: upcomingReps,
        suggestedRepIds: [repA],
      },
    });
  });
  await page.goto(`/admin/accounts/${accountId}`);
  await page.getByRole('button', { name: 'Use suggestion' }).click();
  expect(saved).toBeUndefined();
  const assigned = page.getByRole('combobox', { name: 'Assistant’s assigned reps' });
  await assigned.click();
  await page.getByRole('option', { name: 'Morgan Example' }).click();
  await page.getByRole('button', { name: 'Save shipment access' }).click();
  await expect.poll(() => saved).toEqual({ ownRepId: repA, assignedRepIds: [repB] });
});
