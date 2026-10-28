import { expect, test } from '@playwright/test';

for (const width of [1440, 375]) {
  test(`staff manual Other workflow and admin disable at ${width}px`, async ({ page, browser }) => {
    const origin = 'http://localhost:4176';
    const reference = `manual-other-browser-${width}-${Date.now()}`;
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/shipments`);
    await page.getByLabel('Email', { exact: true }).fill('frontend-staff@example.test');
    await page.getByLabel('Password', { exact: true }).fill('staff fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const carrier = page
      .getByRole('form', { name: 'Add shipment', exact: true })
      .getByRole('combobox', { name: 'Carrier', exact: true });
    await carrier.selectOption({ label: 'Other' });
    await expect(page.getByLabel('Carrier Status', { exact: true })).toHaveValue('Pending Pickup');
    await page.getByLabel('Tracking reference', { exact: true }).fill(reference);
    const today = await page.evaluate(() =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    );
    await page.getByLabel('Pickup date (optional)', { exact: true }).fill(today);
    await page.getByLabel('Delivery date (optional)', { exact: true }).fill(today);
    await page.getByLabel('Date to Follow Up (optional)', { exact: true }).fill(today);
    await page.getByRole('button', { name: 'Add shipment', exact: true }).click();
    await expect(page).toHaveURL(/tab=other/);
    await expect(page.getByLabel('Carrier Status', { exact: true })).toHaveValue('Pending Pickup');
    await expect(page.getByLabel('Pickup date (optional)', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Delivery date (optional)', { exact: true })).toHaveValue('');
    await page.getByRole('link', { name: reference, exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Manual shipment details', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pause monitoring', exact: true })).toHaveCount(
      0,
    );
    const detailUrl = page.url();
    await page.getByLabel('Carrier Status', { exact: true }).selectOption('Delivered');
    await expect(page.getByLabel('Carrier Status', { exact: true })).toHaveValue('Delivered');
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('Shipment changes saved.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByLabel('Carrier Status', { exact: true })).toHaveValue('Delivered');
    await expect(page.getByRole('button', { name: 'Monitor again', exact: true })).toHaveCount(0);
    await page.goto(`${origin}/shipments?tab=attention&q=${reference}`);
    await expect(page.getByRole('link', { name: reference, exact: true })).toBeVisible();
    await page.goto(`${origin}/shipments?tab=delivered&q=${reference}`);
    await expect(page.getByRole('link', { name: reference, exact: true })).toHaveCount(0);
    // Separate administrator browser verifies the real enable/disable UI.
    const admin = await browser.newPage();
    await admin.goto(`${origin}/admin/carriers`);
    await admin.getByLabel('Email', { exact: true }).fill('frontend-admin@example.test');
    await admin.getByLabel('Password', { exact: true }).fill('admin fixture password');
    await admin.getByRole('button', { name: 'Sign in', exact: true }).click();
    await admin.getByRole('link', { name: 'Other', exact: true }).click();
    await admin.getByRole('button', { name: 'Edit carrier', exact: true }).click();
    await expect(admin.getByLabel('Polling interval (minutes)', { exact: true })).toHaveCount(0);
    await admin.getByLabel('Active', { exact: true }).selectOption('false');
    await admin.getByRole('button', { name: 'Save changes', exact: true }).click();
    await admin.getByRole('button', { name: 'Confirm save', exact: true }).click();
    await expect(admin.getByRole('button', { name: 'Edit carrier', exact: true })).toBeVisible();
    await page.goto(detailUrl);
    await page.getByLabel('Carrier Status', { exact: true }).selectOption('Out for delivery');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('Shipment changes saved.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByLabel('Carrier Status', { exact: true })).toHaveValue(
      'Out for delivery',
    );
    await page.getByLabel('Carrier Status', { exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/other-detail-${width}.png` });
    await page.goto(`${origin}/shipments?tab=other`);
    await expect(carrier.locator('option', { hasText: /^Other$/ })).toHaveCount(0);
    await admin.getByRole('button', { name: 'Edit carrier', exact: true }).click();
    await admin.getByLabel('Active', { exact: true }).selectOption('true');
    await admin.getByRole('button', { name: 'Save changes', exact: true }).click();

    await expect(admin.getByRole('button', { name: 'Edit carrier', exact: true })).toBeVisible();
    await admin.close();
  });
}
