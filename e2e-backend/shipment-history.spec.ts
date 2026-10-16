import { expect, test } from '@playwright/test';

const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1`;
test.use({ timezoneId: 'America/Los_Angeles' });
for (const origin of ['http://localhost:4175', 'http://localhost:4176']) {
  test(`persisted history lifecycle and pagination through ${origin}`, async ({
    page,
    context,
  }) => {
    if (origin.endsWith('4176')) await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${origin}/shipments`);
    await page.getByLabel('Email', { exact: true }).fill('frontend-history@example.test');
    await page.getByLabel('Password', { exact: true }).fill('history fixture password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shipments', exact: true })).toBeVisible();
    const search = await context.request.get(`${api}/shipments/search?tab=all&q=fe-history-`);
    expect(search.ok()).toBe(true);
    const { items } = (await search.json()) as {
      items: { externalId: string; trackingReference: string }[];
    };
    const find = (name: string) => {
      const row = items.find((item) => item.trackingReference === `fe-history-${name}`);
      if (!row) throw new Error(`Missing fixture: ${name}`);
      return row.externalId;
    };
    for (const [name, count] of [
      ['empty', 0],
      ['initial', 1],
      ['changed', 2],
      ['unchanged', 1],
      ['failed-later', 2],
    ] as const) {
      const id = find(name);
      const response = await context.request.get(`${api}/shipments/${id}/history`);
      expect(response.status()).toBe(200);
      const history = await response.json();
      expect(history.total).toBe(count);
      expect(JSON.stringify(history)).not.toMatch(
        /Private fixture|sourceData|reasonCode|shipmentId/,
      );
      await page.goto(`${origin}/shipments/${id}?tab=history`);
      await expect(page.getByRole('article')).toHaveCount(count);
      if (count === 0)
        await expect(page.getByText('No tracking observations recorded yet.')).toBeVisible();
      else {
        await expect(page.getByRole('article', { name: /^Initial observation/ })).toHaveCount(1);
        await expect(page.getByRole('article').last()).toContainText('Not available');
        await expect(page.getByRole('article').first()).toContainText(history.items[0].externalId);
      }
      if (count === 2)
        await expect(
          page.getByText('Changed estimated delivery: Not available → 2026-10-20'),
        ).toBeVisible();
      if (name === 'failed-later') {
        await page.getByRole('tab', { name: 'Overview', exact: true }).click();
        await expect(page.getByText(/Latest lookup failed/)).toBeVisible();
        await page.goBack();
        await expect(page.getByRole('article')).toHaveCount(2);
      }
    }
    const id = find('multi-page');
    await page.goto(`${origin}/shipments/${id}?tab=history&page=2`);
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('article')).toContainText('Observation 1');
    await page.getByRole('button', { name: 'Go to previous page' }).click();
    await expect(page.getByRole('article')).toHaveCount(25);
    await expect(page.getByRole('article').first()).toContainText('Observation 26');
    await expect(page.getByRole('article').last()).toContainText('field comparison unavailable');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('region', { name: /Your refresh/ })).toContainText('Run: queued');
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await expect(page.getByRole('region', { name: /Your refresh/ })).toContainText('Run: queued');
    await page.goBack();
    await expect(page.getByRole('article')).toHaveCount(25);
  });
}
