import { expect, test } from '@playwright/test';

test('staff saves, reopens, and copies an immutable comparison through the real API', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('frontend-staff@example.test');
  await page.getByLabel('Password', { exact: true }).fill('staff fixture password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
  await page.goto('/quotes/new');
  await page.getByRole('checkbox', { name: 'myUnishippers', exact: true }).uncheck();
  await page.getByRole('combobox', { name: 'Amazon Shipping sender' }).click();
  await page.getByRole('option', { name: 'Explicit sender' }).click();
  for (const label of ['Amazon Shipping origin', 'Destination']) {
    await page.getByLabel(`${label} name`, { exact: true }).fill('Fixture warehouse');
    await page.getByLabel(`${label} street`, { exact: true }).fill('1 Example Street');
    await page.getByLabel(`${label} city`, { exact: true }).fill('Walworth');
    await page.getByLabel(`${label} state / province`, { exact: true }).fill('WI');
    await page.getByLabel(`${label} postalCode`, { exact: true }).fill('53125');
  }
  for (const [field, value] of Object.entries({
    length: '10.00',
    width: '8',
    height: '6',
    weight: '5',
  }))
    await page.getByLabel(`Group 1 ${field}`, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save comparison', exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  const original = page.url();
  if (process.env.FE_TEST_QUOTE_DEMO === 'true') {
    await expect(page.getByText('Simulated rates — not provider quotes.')).toBeVisible();
    await expect(page.getByText('Completed. These details are read-only.')).toBeVisible();
  } else {
    await expect(
      page.getByText('Queued — waiting for the worker. These details are read-only.'),
    ).toBeVisible();
  }
  await expect(page.getByText(/10.00 × 8 × 6 in/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/10.00 × 8 × 6 in/)).toBeVisible();
  await page.getByRole('link', { name: 'Copy to new comparison' }).click();
  await expect(page.getByLabel('Group 1 length', { exact: true })).toHaveValue('10.00');
  await page.getByLabel('Group 1 length', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Save comparison', exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  expect(page.url()).not.toBe(original);
  await page.goto(original);
  await expect(page.getByText(/10.00 × 8 × 6 in/)).toBeVisible();
});

test('streams partial success and retains it after reload through the real API', async ({
  page,
}) => {
  test.skip(process.env.FE_TEST_QUOTE_DEMO !== 'true', 'Opt-in isolated fixture worker required');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('frontend-staff@example.test');
  await page.getByLabel('Password', { exact: true }).fill('staff fixture password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
  const address = {
    name: 'Fixture warehouse',
    street: '1 Example Street',
    city: 'Walworth',
    division: 'WI',
    postalCode: '53125',
    country: 'US',
  };
  const apiOrigin = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}`;
  const created = await page.request.post(`${apiOrigin}/api/v1/quote-comparisons`, {
    headers: { Origin: 'http://localhost:4175' },
    data: {
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
          quantity: 1,
          units: 'imperial',
          length: '10',
          width: '8',
          height: '6',
          weight: '5',
          customsItems: [],
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const { comparison } = await created.json();
  await page.goto(`/quotes/${comparison.externalId}`);
  await expect(
    page.getByText('Completed with partial results. These details are read-only.'),
  ).toBeVisible();
  await expect(page.getByText(/12.500000 USD/)).toBeVisible();
  await expect(page.getByText('The provider rejected these inputs.')).toBeVisible();
  await page.reload();
  await expect(page.getByText(/12.500000 USD/)).toBeVisible();
  await expect(page.getByText('The provider rejected these inputs.')).toBeVisible();
});
