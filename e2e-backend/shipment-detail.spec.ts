import { expect, test } from '@playwright/test';

const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1`;
for (const origin of ['http://localhost:4175', 'http://localhost:4176']) {
  test(`detail notes, actions, runs and deletion use the real API through ${origin}`, async ({
    page,
    context,
    request,
  }) => {
    const reactWarnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Cannot update a component'))
        reactWarnings.push(message.text());
    });
    if (origin.endsWith('4176')) await page.setViewportSize({ width: 375, height: 812 });
    const headers = { Origin: origin };
    await page.goto(`${origin}/shipments`);
    await page.getByLabel('Email', { exact: true }).fill('frontend-details@example.test');
    await page.getByLabel('Password', { exact: true }).fill('details fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shipments', exact: true })).toBeVisible();
    const carriers = await (await context.request.get(`${api}/carriers`)).json();
    const carrier = carriers.find((value: { code: string }) => value.code === 'ups');
    const creation = await context.request.post(`${api}/shipments`, {
      headers,
      data: {
        carrierExternalId: carrier.externalId,
        trackingReference: `fe-detail-${origin.slice(-4)}-${Date.now()}`,
        notes: 'Original note',
      },
    });
    expect(creation.status()).toBe(201);
    const shipment = (await creation.json()).shipment;
    let removed = false;
    let disabled = false;
    const dismissToast = async () => {
      const close = page.locator('.MuiSnackbar-root').getByRole('button', { name: 'Close' });
      if (await close.isVisible()) await close.click();
    };
    try {
      await page.goto(`${origin}/shipments/${shipment.externalId}`);
      await expect(
        page.getByRole('heading', { name: shipment.trackingReference, exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Edit notes' }).click();
      await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('My unsaved note');
      expect(
        (
          await context.request.patch(`${api}/shipments/${shipment.externalId}`, {
            headers,
            data: { notes: 'Changed elsewhere' },
          })
        ).status(),
      ).toBe(200);
      await expect(page.getByText('Notes changed elsewhere')).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(
        'My unsaved note',
      );
      await page.getByRole('button', { name: 'Save my draft anyway' }).click();
      await expect(page.getByRole('button', { name: 'Edit notes' })).toBeVisible();
      expect(
        (await (await context.request.get(`${api}/shipments/${shipment.externalId}`)).json()).notes,
      ).toBe('My unsaved note');
      await dismissToast();
      await page.getByRole('button', { name: 'Edit notes' }).click();
      await page.getByRole('textbox', { name: 'Notes', exact: true }).fill(' ');
      await page.getByRole('button', { name: 'Save notes' }).click();
      await expect(page.getByRole('button', { name: 'Edit notes' })).toBeVisible();
      expect(
        (await (await context.request.get(`${api}/shipments/${shipment.externalId}`)).json()).notes,
      ).toBeNull();
      await dismissToast();

      await page.getByRole('button', { name: 'Pause monitoring', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Resume monitoring', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
      expect(
        (
          await context.request.post(`${api}/shipments/${shipment.externalId}/refresh`, { headers })
        ).status(),
      ).toBe(409);
      await dismissToast();
      await page.getByRole('button', { name: 'Resume monitoring', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Pause monitoring', exact: true }),
      ).toBeVisible();
      await dismissToast();
      const refreshResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/${shipment.externalId}/refresh`) &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      const accepted = await refreshResponse;
      expect(accepted.status()).toBe(202);
      const queued = await accepted.json();
      await expect(
        page
          .getByRole('region', { name: /Your refresh/ })
          .getByText('Run: queued', { exact: true }),
      ).toBeVisible();
      const coalesced = await context.request.post(
        `${api}/shipments/${shipment.externalId}/refresh`,
        { headers },
      );
      expect((await coalesced.json()).externalId).toBe(queued.externalId);
      await dismissToast();

      // Live 404 removes the detail and draft, without another page reload.
      await page.getByRole('button', { name: 'Edit notes' }).click();
      await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Draft before deletion');
      expect(
        (
          await context.request.delete(`${api}/shipments/${shipment.externalId}`, { headers })
        ).status(),
      ).toBe(204);
      removed = true;
      await expect(page.getByRole('heading', { name: 'Shipment unavailable' })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Shipment unavailable' })).toBeVisible();

      // Re-add creates a different UUID; delete through the real confirmation flow.
      const readded = await context.request.post(`${api}/shipments`, {
        headers,
        data: {
          carrierExternalId: carrier.externalId,
          trackingReference: shipment.trackingReference,
        },
      });
      const replacement = (await readded.json()).shipment;
      expect(replacement.externalId).not.toBe(shipment.externalId);
      shipment.externalId = replacement.externalId;
      removed = false;
      await page.goto(`${origin}/shipments/${shipment.externalId}`);
      await page.getByRole('button', { name: 'Delete shipment', exact: true }).click();
      const confirm = page.getByRole('dialog', { name: 'Delete shipment?' });
      await expect(
        confirm.getByText(`${carrier.name} · ${shipment.trackingReference}`),
      ).toBeVisible();
      await confirm.getByRole('button', { name: 'Delete shipment', exact: true }).click();
      await expect(page).toHaveURL(`${origin}/shipments`);
      expect((await context.request.get(`${api}/shipments/${shipment.externalId}`)).status()).toBe(
        404,
      );
      removed = true;

      const find = async (reference: string) => {
        const result = await context.request.get(`${api}/shipments/search`, {
          params: { tab: 'all', q: reference },
        });
        expect(result.ok()).toBe(true);
        return (await result.json()).items[0];
      };
      for (const status of ['running', 'succeeded', 'partially_succeeded', 'failed', 'cancelled']) {
        const row = await find(`fe-detail-${status}`);
        await page.goto(`${origin}/shipments/${row.externalId}`);
        await expect(
          page
            .getByRole('region', { name: 'Latest run', exact: true })
            .getByText(`Run: ${status.replaceAll('_', ' ')}`, { exact: true }),
        ).toBeVisible();
      }
      const failed = await find('fe-list-0001');
      await page.goto(`${origin}/shipments/${failed.externalId}`);
      await expect(
        page
          .getByRole('region', { name: 'Tracking', exact: true })
          .getByText('In transit', { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/Latest lookup failed/)).toBeVisible();
      const threshold = await find('fe-list-0901');
      await page.goto(`${origin}/shipments/${threshold.externalId}`);
      await expect(
        page.getByRole('button', { name: 'Resume monitoring', exact: true }),
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
      expect(
        (
          await context.request.post(`${api}/shipments/${threshold.externalId}/resume`, {
            headers,
            data: {},
          })
        ).status(),
      ).toBe(409);
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect(page.getByRole('region', { name: /Your refresh/ })).toBeVisible();
      const delivered = await find('fe-list-0951');
      await page.goto(`${origin}/shipments/${delivered.externalId}`);
      await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
      expect(
        (
          await context.request.post(`${api}/shipments/${delivered.externalId}/refresh`, {
            headers,
          })
        ).status(),
      ).toBe(409);

      const login = await request.post(`${api}/auth/sign-in`, {
        headers,
        data: {
          email: `frontend-details-${origin.slice(-4)}-admin@example.test`,
          password: 'admin fixture password',
        },
      });
      expect(login.ok()).toBe(true);
      expect(
        (
          await request.patch(`${api}/carriers/${carrier.externalId}`, {
            headers,
            data: { isActive: false },
          })
        ).ok(),
      ).toBe(true);
      disabled = true;
      await page.goto(`${origin}/shipments/${failed.externalId}`);
      await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
      await expect(page.getByText('Carrier is disabled.', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    } finally {
      if (!removed)
        await context.request.delete(`${api}/shipments/${shipment.externalId}`, { headers });
      if (disabled)
        expect(
          (
            await request.patch(`${api}/carriers/${carrier.externalId}`, {
              headers,
              data: { isActive: carrier.isActive },
            })
          ).ok(),
        ).toBe(true);
    }
    expect(reactWarnings).toEqual([]);
  });
}
