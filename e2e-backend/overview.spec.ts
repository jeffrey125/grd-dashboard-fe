import { overviewSchema } from '@features/overview/api';
import { searchResponseSchema } from '@features/shipments/schemas';
import { expect, test } from '@playwright/test';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1`;
test.use({ timezoneId: 'America/Los_Angeles' });
for (const origin of ['http://localhost:4175', 'http://localhost:4176']) {
  test(`overview counts, dates and drill-downs agree with the real API through ${origin}`, async ({
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
    expect(data.attention.items).toHaveLength(10);
    const today = dayjs(data.asOf).tz(data.timezone).format('YYYY-MM-DD');
    expect(data.upcomingWindow).toEqual({
      from: today,
      to: dayjs(today).add(6, 'day').format('YYYY-MM-DD'),
    });
    for (const [tab, label] of [
      ['all', 'All shipments'],
      ['active', 'Active'],
      ['paused', 'Paused'],
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
        expect(search.items.slice(0, 10).map((row) => row.externalId)).toEqual(
          data.attention.items.map((row) => row.externalId),
        );
    }
    await page.getByRole('link', { name: 'View all upcoming deliveries' }).click();
    const params = new URL(page.url()).searchParams;
    params.set('pageSize', '100');
    const result = await context.request.get(`${api}/shipments/search?${params}`);
    expect(result.ok()).toBe(true);
    const upcoming = searchResponseSchema.parse(await result.json());
    expect(upcoming.total).toBe(data.upcomingDeliveries.total);
    // The panel breaks ETA ties by creation/id; search uses id. Compare membership,
    // not a first-page ordering guarantee the API does not offer.
    const matches = [...upcoming.items];
    for (let next = 2; next <= Math.ceil(upcoming.total / 100); next++) {
      params.set('page', String(next));
      const nextResponse = await context.request.get(`${api}/shipments/search?${params}`);
      expect(nextResponse.ok()).toBe(true);
      matches.push(...searchResponseSchema.parse(await nextResponse.json()).items);
    }
    const ids = new Set(matches.map((row) => row.externalId));
    expect(ids.size).toBe(upcoming.total);
    for (const row of data.upcomingDeliveries.items) expect(ids.has(row.externalId)).toBe(true);
    for (const row of matches) {
      expect(row.monitoringStatus).not.toBe('completed');
      const eta = row.currentTracking?.estimatedDeliveryOn;
      expect(eta).toBeTruthy();
      expect(eta && eta >= data.upcomingWindow.from && eta <= data.upcomingWindow.to).toBe(true);
    }
    await expect(page.getByText('Undelivered only', { exact: true })).toBeVisible();
    await page.goto(origin);
    const recent = data.recentChanges[0];
    if (!recent) throw new Error('Expected persisted tracking observations');
    await page
      .getByRole('region', { name: 'Recent tracking changes' })
      .getByRole('link')
      .first()
      .click();
    await expect(page).toHaveURL(/tab=history/);
    await expect(
      page.getByRole('heading', { name: 'Tracking history', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`Snapshot ID: ${recent.snapshot.externalId}`, { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to Overview' }).click();
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
