import { overviewSchema } from '@features/overview/api';
import { searchResponseSchema } from '@features/shipments/schemas';
import { expect, test } from '@playwright/test';

const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1`;
test.use({ timezoneId: 'America/Los_Angeles' });
for (const origin of ['http://localhost:4175', 'http://localhost:4176']) {
  test(`overview counts and attention agree with the real API through ${origin}`, async ({
    page,
    context,
  }) => {
    if (origin.endsWith('4176')) await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(origin);
    await page.getByLabel('Email', { exact: true }).fill('frontend-staff@example.test');
    await page.getByLabel('Password', { exact: true }).fill('staff fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    const response = await context.request.get(`${api}/dashboard/overview`);
    expect(response.ok()).toBe(true);
    expect(response.headers()['cache-control']).toBe('no-store');
    const data = overviewSchema.parse(await response.json());
    expect(data.counts.all).toBeGreaterThanOrEqual(1000);
    expect(data.attention.items).toHaveLength(5);
    for (const [tab, label] of [
      ['all', 'All shipments'],
      ['active', 'Active'],
      ['delivered', 'Delivered'],
      ['attention', 'Needs attention'],
    ] as const) {
      const result = await context.request.get(`${api}/shipments/search?tab=${tab}`);
      expect(result.ok()).toBe(true);
      const search = searchResponseSchema.parse(await result.json());
      expect(search.total).toBe(data.counts[tab]);
      expect(search.tabCounts).toEqual(data.counts);
      await expect(
        page.getByRole('link', { name: `${label}: ${search.total}`, exact: true }),
      ).toBeVisible();
      if (tab === 'attention')
        expect(search.items.slice(0, 5).map((row) => row.externalId)).toEqual(
          data.attention.items.map((row) => row.externalId),
        );
    }
    await expect(page.getByRole('region', { name: 'Upcoming deliveries' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Recent tracking changes' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
