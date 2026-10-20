import { expect, type Page, test } from '@playwright/test';

const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1`;
const address = {
  name: 'Fixture warehouse',
  street: '1 Example Street',
  city: 'Walworth',
  division: 'WI',
  postalCode: '53125',
  country: 'US',
  contactName: 'Fixture Contact',
  phone: '2025550147',
};
const input = () => ({
  idempotencyKey: crypto.randomUUID(),
  shipDate: '2099-10-19',
  destination: address,
  providers: ['amazon', 'unishippers'].map((code) => ({
    code,
    sender: { mode: 'explicit', address },
    options: { signature: 'none', insurance: null },
  })),
  packageGroups: [
    {
      quantity: 2,
      units: 'metric',
      length: '25.4',
      width: '20.32',
      height: '15.24',
      weight: '2.267962',
      customsItems: [],
    },
    {
      quantity: 1,
      units: 'imperial',
      length: '12',
      width: '8',
      height: '6',
      weight: '4',
      customsItems: [],
    },
  ],
});
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('frontend-staff@example.test');
  await page.getByLabel('Password', { exact: true }).fill('staff fixture password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
}
async function create(page: Page, data: unknown) {
  const response = await page.request.post(`${api}/quote-comparisons`, {
    headers: { Origin: 'http://localhost:4175' },
    data,
  });
  expect([200, 201]).toContain(response.status());
  return (await response.json()).comparison;
}
async function noPurchaseActions(page: Page) {
  await expect(
    page.getByRole('button', {
      name: /purchase|buy label|book shipment|schedule pickup|use this rate|save address|create shipment/i,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', {
      name: /purchase|buy label|book shipment|schedule pickup|use this rate|save address|create shipment/i,
    }),
  ).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.FE_TEST_QUOTE_READINESS !== 'true',
    'Opt-in isolated readiness fixture required',
  );
  await signIn(page);
});

test('deduplicates submissions, refetches after SSE reconnect, and distinguishes multi-group totals', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.EventSource;
    const sources: EventSource[] = [];
    Object.assign(window, { quoteTestSources: sources });
    window.EventSource = class extends Native {
      constructor(url: string | URL, options?: EventSourceInit) {
        super(url, options);
        if (String(url).includes('/quote-comparisons/')) sources.push(this);
      }
    };
  });
  const body = input();
  const [first, duplicate] = await Promise.all([create(page, body), create(page, body)]);
  expect(duplicate.externalId).toBe(first.externalId);
  let snapshots = 0;
  page.on('response', (response) => {
    if (
      response.url().endsWith(`/quote-comparisons/${first.externalId}`) &&
      response.request().method() === 'GET'
    )
      snapshots++;
  });
  await page.goto(`/quotes/${first.externalId}`);
  await expect(
    page.getByText(
      'Some prices are ready — waiting for the remaining providers. These details are read-only.',
    ),
  ).toBeVisible();
  const before = snapshots;
  await page.evaluate(() => {
    const sources = (window as unknown as { quoteTestSources: EventSource[] }).quoteTestSources;
    const source = sources.at(-1);
    if (!source) throw new Error('Quote SSE connection missing');
    source.close();
    source.dispatchEvent(new Event('error'));
  });
  await expect.poll(() => snapshots).toBeGreaterThan(before);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { quoteTestSources: EventSource[] }).quoteTestSources.length,
      ),
    )
    .toBeGreaterThan(1);
  const released = await page.request.post(
    `${api.replace('/api/v1', '')}/__test/quote-release/${body.idempotencyKey}`,
  );
  expect(released.status()).toBe(204);
  await expect(page.getByText('Completed. These details are read-only.')).toBeVisible();
  await expect(page.getByText('Calculated estimate', { exact: true })).toBeVisible();
  await expect(page.getByText('Whole-shipment total', { exact: true })).toBeVisible();
  await expect(page.getByText('$39.62 USD', { exact: true })).toBeVisible();
  await expect(page.getByText('$35.00 USD', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'What’s included in this price?' }).first().click();
  await noPurchaseActions(page);
  await page.reload();
  await expect(page.getByText('Calculated estimate', { exact: true })).toBeVisible();
  await expect(page.getByText('Whole-shipment total', { exact: true })).toBeVisible();
});

test('keeps international capability, original units, native currency and unknown costs explicit', async ({
  page,
}) => {
  const body = input();
  const saved = await create(page, {
    ...body,
    destination: {
      ...address,
      country: 'CA',
      city: 'Toronto',
      division: 'ON',
      postalCode: 'M5V 3L9',
    },
    international: {
      contentsDescription: 'Fixture goods',
      customsMode: 'summary',
      totalValue: { amount: '20', currency: 'USD' },
    },
    providers: body.providers.map((provider) => ({
      ...provider,
      options: { signature: 'signature', insurance: { amount: '10', currency: 'USD' } },
    })),
  });
  await page.goto(`/quotes/${saved.externalId}`);
  await expect(
    page.getByText('Completed with partial results. These details are read-only.'),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole('alert').filter({ hasText: 'This request is not supported by the provider.' }),
  ).toBeVisible();
  await expect(page.getByText('45.00 CAD', { exact: true })).toBeVisible();
  await expect(page.getByText('Lowest price', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'What’s included in this price?' }).click();
  await expect(page.getByText('Requested options: unverified', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Duty: unknown · Tax: unknown · Clearance: unknown', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Check shipment details', exact: true }).click();
  await expect(page.getByText(/25.4 × 20.32 × 15.24 cm/)).toBeVisible();
  await noPurchaseActions(page);
});
