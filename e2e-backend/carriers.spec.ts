import { carrierSchema, settings } from '@features/carriers/schemas';
import { expect, test } from '@playwright/test';

const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1`;
for (const origin of ['http://localhost:4175', 'http://localhost:4176']) {
  test(`carrier Admin settings, eligibility and Staff restrictions through ${origin}`, async ({
    page,
    context,
    browser,
  }) => {
    if (origin.endsWith('4176')) await page.setViewportSize({ width: 375, height: 812 });
    const headers = { Origin: origin };
    const port = origin.slice(-4);
    await page.goto(`${origin}/admin/carriers`);
    await page
      .getByLabel('Email', { exact: true })
      .fill(`frontend-carriers-${port}-admin@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('admin fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Carriers', exact: true })).toBeVisible();
    const list = carrierSchema
      .array()
      .parse(await (await context.request.get(`${api}/carriers`)).json());
    const ups = list.find((row) => row.code === 'ups');
    const ffe = list.find((row) => row.code === 'ffe');
    if (!ups || !ffe) throw new Error('Missing migration carriers');
    const created = await context.request.post(`${api}/shipments`, {
      headers,
      data: {
        carrierExternalId: ups.externalId,
        trackingReference: `carrier-admin-${origin.slice(-4)}`,
      },
    });
    expect(created.status()).toBe(201);
    const shipment = (await created.json()).shipment;
    const staffContext = await browser.newContext();
    try {
      for (const input of [
        { code: 'ffe' },
        { externalId: ups.externalId },
        { name: null },
        { isActive: null },
        { fetchMode: null },
        { notFoundPauseThreshold: null },
        { pollIntervalMinutes: null },
        { rateLimitPerMinute: 0 },
        { rateLimitPerMinute: 32768 },
        { rateLimitPerMinute: 1.5 },
        { notFoundPauseThreshold: 1 },
        { notFoundPauseThreshold: 32768 },
        { pollIntervalMinutes: 0 },
        { pollIntervalMinutes: 32768 },
        { pollIntervalMinutes: '5' },
        { fetchMode: 'browser' },
      ]) {
        expect(
          (
            await context.request.patch(`${api}/carriers/${ups.externalId}`, {
              headers,
              data: input,
            })
          ).status(),
        ).toBe(400);
      }
      for (const row of list.filter((row) => row.code !== 'ups')) {
        for (const fetchMode of ['browser', 'request'])
          expect(
            (
              await context.request.patch(`${api}/carriers/${row.externalId}`, {
                headers,
                data: { fetchMode },
              })
            ).status(),
          ).toBe(200);
      }
      expect(
        (
          await context.request.patch(`${api}/carriers/${ffe.externalId}`, {
            headers,
            data: { notFoundPauseThreshold: 2, pollIntervalMinutes: 1, rateLimitPerMinute: 32767 },
          })
        ).status(),
      ).toBe(200);
      await page.getByRole('link', { name: ups.name, exact: true }).click();
      await page.getByRole('button', { name: 'Edit carrier' }).click();
      await page.getByLabel('Name', { exact: true }).fill('UPS browser edited');
      await page.getByLabel('Requests per minute', { exact: true }).fill('');
      await page.getByLabel('Active', { exact: true }).selectOption('false');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByRole('button', { name: 'Confirm save' }).click();
      await expect(page.getByRole('button', { name: 'Edit carrier' })).toBeVisible();
      const saved = carrierSchema.parse(
        await (await context.request.get(`${api}/carriers/${ups.externalId}`)).json(),
      );
      expect(saved).toMatchObject({
        ...settings(ups),
        name: 'UPS browser edited',
        isActive: false,
        rateLimitPerMinute: null,
      });
      expect((await context.request.get(`${api}/shipments/${shipment.externalId}`)).status()).toBe(
        200,
      );
      expect(
        (
          await context.request.post(`${api}/shipments`, {
            headers,
            data: { carrierExternalId: ups.externalId, trackingReference: 'disabled-create' },
          })
        ).status(),
      ).toBe(400);
      expect(
        (
          await context.request.post(`${api}/shipments/${shipment.externalId}/refresh`, {
            headers,
            data: {},
          })
        ).status(),
      ).toBe(409);

      const staffLogin = await staffContext.request.post(`${api}/auth/sign-in`, {
        headers,
        data: {
          email: `frontend-carriers-${port}-staff@example.test`,
          password: 'staff fixture password',
        },
      });
      expect(staffLogin.status()).toBe(200);
      expect((await staffContext.request.get(`${api}/carriers`)).status()).toBe(200);
      expect((await staffContext.request.get(`${api}/carriers/${ups.externalId}`)).status()).toBe(
        200,
      );
      expect(
        (
          await staffContext.request.patch(`${api}/carriers/${ups.externalId}`, {
            headers,
            data: { isActive: true },
          })
        ).status(),
      ).toBe(403);
      const staffPage = await staffContext.newPage();
      await staffPage.goto(`${origin}/admin/carriers/${ups.externalId}`);
      await expect(
        staffPage.getByText('You do not have permission to view this page.'),
      ).toBeVisible();
      await page.goto(`${origin}/shipments`);
      await expect(
        page
          .getByRole('form', { name: 'Add shipment', exact: true })
          .getByRole('option', { name: saved.name, exact: true }),
      ).toHaveCount(0);
    } finally {
      for (const row of list)
        expect(
          (
            await context.request.patch(`${api}/carriers/${row.externalId}`, {
              headers,
              data: settings(row),
            })
          ).status(),
        ).toBe(200);
      await context.request.delete(`${api}/shipments/${shipment.externalId}`, { headers });
      await staffContext.close();
    }
  });
}
