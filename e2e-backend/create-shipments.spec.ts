import { expect, test } from '@playwright/test';

for (const origin of ['http://localhost:4175', 'http://localhost:4176']) {
  test(`creates one shipment at a time and handles real duplicates through ${origin}`, async ({
    page,
    context,
    request,
  }) => {
    if (origin.endsWith('4176')) await page.setViewportSize({ width: 375, height: 812 });
    const api = 'http://localhost:3000/api/v1';
    const headers = { Origin: origin };
    const port = origin.slice(-4);
    const prefix = `fe-create-${port}-${Date.now()}`;
    await page.goto(`${origin}/shipments`);
    await page
      .getByLabel('Email', { exact: true })
      .fill(`frontend-create-${port}-staff@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('shipments fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shipments', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add shipment', exact: true })).toBeVisible();

    const carriers = await (await context.request.get(`${api}/carriers`)).json();
    const carrier = carriers.find((value: { code: string }) => value.code === 'ups');
    const item = (suffix: string, notes: string | null = null) => ({
      carrierExternalId: carrier.externalId,
      trackingReference: `${prefix}-${suffix}`,
      notes,
    });
    const seeded = await context.request.post(`${api}/shipments`, {
      headers,
      data: item('existing', 'Original notes'),
    });
    expect(seeded.status()).toBe(201);
    const existing = (await seeded.json()).shipment;
    await context.request.post(`${api}/shipments/${existing.externalId}/pause`, {
      headers,
      data: {},
    });
    const createdIds = [existing.externalId];
    let carrierDisabled = false;
    const addForm = page.getByRole('form', { name: 'Add shipment', exact: true });

    const fill = async (suffix: string, notes?: string) => {
      await addForm.getByLabel('Carrier', { exact: true }).selectOption(carrier.externalId);
      await addForm.getByLabel('Tracking reference', { exact: true }).fill(`${prefix}-${suffix}`);
      if (notes !== undefined)
        await addForm.getByLabel('Notes (optional)', { exact: true }).fill(notes);
    };

    try {
      await fill('new', '   ');
      const createdResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/shipments') && response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Add shipment', exact: true }).click();
      const created = await createdResponse;
      expect(created.status()).toBe(201);
      const createdResult = await created.json();
      expect(createdResult).toMatchObject({
        outcome: 'created',
        shipment: { trackingReference: `${prefix}-new`, notes: null },
      });
      createdIds.push(createdResult.shipment.externalId);
      await expect(page.getByRole('alert').filter({ hasText: 'Shipment added.' })).toBeVisible();
      await expect(addForm.getByLabel('Carrier', { exact: true })).toHaveValue(carrier.externalId);
      await expect(addForm.getByLabel('Tracking reference', { exact: true })).toHaveValue('');

      await fill('existing', 'Do not overwrite');
      const duplicateResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/shipments') && response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Add shipment', exact: true }).click();
      const duplicate = await duplicateResponse;
      expect(duplicate.status()).toBe(200);
      expect(await duplicate.json()).toMatchObject({
        outcome: 'existing',
        shipment: {
          externalId: existing.externalId,
          notes: 'Original notes',
          monitoringStatus: 'paused',
        },
      });
      await expect(
        page
          .getByRole('alert')
          .filter({ hasText: 'Shipment already exists. Existing notes and status were retained.' }),
      ).toBeVisible();

      const adminLogin = await request.post(`${api}/auth/sign-in`, {
        headers,
        data: {
          email: `frontend-create-${port}-admin@example.test`,
          password: 'admin fixture password',
        },
      });
      expect(adminLogin.ok()).toBe(true);
      await fill('disabled-race');
      await page.route('**/api/v1/shipments', async (route) => {
        const disabled = await request.patch(`${api}/carriers/${carrier.externalId}`, {
          headers,
          data: { isActive: false },
        });
        expect(disabled.ok()).toBe(true);
        carrierDisabled = true;
        await route.continue();
      });
      await page.getByRole('button', { name: 'Add shipment', exact: true }).click();
      await expect(
        page.getByText('Carrier is unavailable. Choose an enabled carrier.'),
      ).toBeVisible();
      await expect(addForm.getByLabel('Tracking reference', { exact: true })).toHaveValue(
        `${prefix}-disabled-race`,
      );
    } finally {
      if (carrierDisabled) {
        const restored = await request.patch(`${api}/carriers/${carrier.externalId}`, {
          headers,
          data: { isActive: carrier.isActive },
        });
        expect(restored.ok()).toBe(true);
      }
      for (const id of createdIds)
        await context.request.delete(`${api}/shipments/${id}`, { headers });
    }
  });
}
