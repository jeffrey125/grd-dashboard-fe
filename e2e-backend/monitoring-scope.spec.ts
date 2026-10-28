import { expect, test } from '@playwright/test';

const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1`;

test('authenticated Mine/Everyone filters real records and survives navigation and reload', async ({
  page,
  context,
  playwright,
  baseURL,
}) => {
  const other = await playwright.request.newContext({
    extraHTTPHeaders: { Origin: baseURL ?? 'http://localhost:4175' },
  });
  try {
    expect(
      (
        await other.post(`${api}/auth/sign-in`, {
          data: {
            email: 'frontend-admin@example.test',
            password: 'admin fixture password',
          },
        })
      ).ok(),
    ).toBe(true);
    const carriers = (await (await other.get(`${api}/carriers`)).json()) as {
      externalId: string;
      code: string;
    }[];
    const carrier = carriers.find((value) => value.code === 'ups');
    if (!carrier) throw new Error('UPS fixture missing');
    const marker = `scope-${Date.now()}`;
    const team = await other.post(`${api}/shipments`, {
      data: {
        carrierExternalId: carrier.externalId,
        trackingReference: `${marker}-team`,
      },
    });
    expect(team.status()).toBe(201);

    await page.goto('/');
    await page.getByLabel('Email', { exact: true }).fill('frontend-staff@example.test');
    await page.getByLabel('Password', { exact: true }).fill('staff fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mine', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const created = await context.request.post(`${api}/shipments`, {
      headers: { Origin: baseURL ?? 'http://localhost:4175' },
      data: { carrierExternalId: carrier.externalId, trackingReference: `${marker}-mine` },
    });
    expect(created.status()).toBe(201);
    await page.goto(`/shipments?tab=all&q=${marker}`);
    await expect(page.getByText(`${marker}-mine`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${marker}-team`, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Everyone', exact: true }).click();
    await expect(page.getByText(`${marker}-team`, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Everyone', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText(`${marker}-team`, { exact: true })).toBeVisible();
    await page.goto('/');
    const response = await context.request.get(`${api}/dashboard/overview?scope=everyone`);
    const overview = await response.json();
    await expect(
      page.getByRole('link', { name: `All shipments: ${overview.counts.all}`, exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Mine', exact: true }).click();
    const mine = await (await context.request.get(`${api}/dashboard/overview?scope=mine`)).json();
    await expect(
      page.getByRole('link', { name: `All shipments: ${mine.counts.all}`, exact: true }),
    ).toBeVisible();
    expect(mine.counts.all).toBeLessThan(overview.counts.all);
    await page.getByRole('button', { name: 'Everyone', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill('frontend-admin@example.test');
    await page.getByLabel('Password', { exact: true }).fill('admin fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mine', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await other.dispose();
  }
});
