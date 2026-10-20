import { expect, test } from '@playwright/test';

for (const origin of ['http://localhost:4175', 'http://localhost:4176']) {
  test(`shipment list uses 1,000 real PostgreSQL records through ${origin}`, async ({
    page,
    context,
  }) => {
    await page.goto(`${origin}/shipments?q=fe-list-`);
    await page.getByLabel('Email', { exact: true }).fill('frontend-shipments@example.test');
    await page.getByLabel('Password', { exact: true }).fill('shipments fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Active (798)', exact: true })).toBeVisible();
    await expect(
      page.getByRole('tab', { name: 'All shipments (1000)', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('tab', { name: 'Needs attention (152)', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'fe-list-0800', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Go to next page' }).click();
    await expect(page.getByRole('link', { name: 'fe-list-0775', exact: true })).toBeVisible();
    await page.getByLabel('Search reference or notes').fill('unique-off-page-note');
    await expect(page.getByRole('tab', { name: 'Active (0)', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Needs attention (1)', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Needs attention (1)', exact: true }).click();
    await expect(page.getByRole('link', { name: 'fe-list-0001', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'fe-list-0001', exact: true })).toBeVisible();

    const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1`;
    const carriers = await (await context.request.get(`${api}/carriers`)).json();
    const carrier = carriers.find((value: { code: string }) => value.code === 'ups');
    const combinations: Array<{ total: number } & Record<string, string | number>> = [
      { tab: 'all', q: 'fe-list-', total: 1000 },
      { tab: 'paused', q: 'fe-list-', total: 150 },
      { tab: 'attention', q: 'fe-list-', total: 152 },
      {
        tab: 'all',
        q: 'fe-list-',
        carrierExternalId: carrier.externalId,
        total: 1000,
      },
    ];
    for (const { total, ...params } of combinations) {
      const response = await context.request.get(`${api}/shipments/search`, { params });
      expect(response.ok()).toBe(true);
      expect((await response.json()).total).toBe(total);
    }
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByLabel('Search reference or notes').fill('fe-list-');
    const filters = page.getByRole('form', { name: 'Shipment filters' });
    await filters.getByLabel('Carrier', { exact: true }).selectOption(carrier.externalId);
    await filters.getByRole('button', { name: 'Apply filters' }).click();
    await expect(
      page.getByRole('tab', { name: 'Needs attention (152)', exact: true }),
    ).toBeVisible();
    await page.getByRole('columnheader', { name: 'Tracking Number' }).click();
    await expect(page).toHaveURL(/sortBy=trackingReference/);
    await page.getByRole('link', { name: 'fe-list-0001', exact: true }).click();
    await page.getByRole('link', { name: 'Back to results' }).click();
    await expect(filters.getByLabel('Carrier', { exact: true })).toHaveValue(carrier.externalId);
    await expect(
      page.getByRole('tab', { name: 'Needs attention (152)', exact: true }),
    ).toBeVisible();

    const reference = `row-action-${origin.slice(-4)}`;
    const headers = { Origin: origin };
    const created = await context.request.post(`${api}/shipments`, {
      headers,
      data: { carrierExternalId: carrier.externalId, trackingReference: reference },
    });
    expect(created.status()).toBe(201);
    const shipment = (await created.json()).shipment;
    await page.goto(`${origin}/shipments?q=${reference}`);
    await expect(page.getByRole('tab', { name: 'Active (1)', exact: true })).toBeVisible();
    const openActions = async () => {
      await page.locator('.MuiDataGrid-virtualScroller').evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      await page.getByRole('button', { name: `Actions for ${reference}`, exact: true }).click();
    };
    await openActions();
    const refreshResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/shipments/${shipment.externalId}/refresh`) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('menuitem', { name: 'Refresh', exact: true }).click();
    const refresh = await refreshResponse;
    expect(refresh.status()).toBe(202);
    const queued = await refresh.json();
    const coalesced = await context.request.post(
      `${api}/shipments/${shipment.externalId}/refresh`,
      { headers, data: {} },
    );
    expect(coalesced.status()).toBe(202);
    expect((await coalesced.json()).externalId).toBe(queued.externalId);
    await expect(page.getByText(/refresh queued or joined/)).toBeVisible();
    await page.locator('.MuiSnackbar-root').getByRole('button', { name: 'Close' }).click();
    await openActions();
    await page.getByRole('menuitem', { name: 'Pause monitoring', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Active (0)', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Needs attention (1)', exact: true }).click();
    await openActions();
    await page.getByRole('menuitem', { name: 'Resume monitoring', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Needs attention (0)', exact: true })).toBeVisible();
    expect(
      (
        await context.request.delete(`${api}/shipments/${shipment.externalId}`, { headers })
      ).status(),
    ).toBe(204);
  });
}
