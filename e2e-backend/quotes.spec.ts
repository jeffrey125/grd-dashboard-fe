import { expect, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('frontend-staff@example.test');
  await page.getByLabel('Password', { exact: true }).fill('staff fixture password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
}

test('staff saves, reopens, and copies an immutable comparison through the real API', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/quotes/new');
  for (const provider of ['Amazon Shipping', 'myUnishippers']) {
    await page.getByRole('combobox', { name: `${provider} sender` }).click();
    await page.getByRole('option', { name: 'Explicit sender' }).click();
  }
  for (const label of ['Amazon Shipping origin', 'myUnishippers origin', 'Destination']) {
    await page.getByLabel(`${label} name`, { exact: true }).fill('Fixture warehouse');
    await page.getByLabel(`${label} street`, { exact: true }).fill('1 Example Street');
    await page.getByLabel(`${label} city`, { exact: true }).fill('Walworth');
    await page.getByRole('combobox', { name: `${label} state / province`, exact: true }).click();
    await page.getByRole('option', { name: 'Wisconsin', exact: true }).click();
    await page.getByLabel(`${label} postalCode`, { exact: true }).fill('53125');
  }
  for (const label of ['myUnishippers origin', 'myUnishippers receiver']) {
    await page.getByLabel(`${label} contact name`, { exact: true }).fill('Fixture Contact');
    await page.getByLabel(`${label} phone number`, { exact: true }).fill('+1 (202) 555-0147');
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
    await expect(page.getByText(/Test data — example prices/)).toHaveCount(1);
    await expect(
      page.getByText('Completed with partial results. These details are read-only.'),
    ).toBeVisible();
  } else {
    await expect(
      page.getByText('Waiting to request prices. These details are read-only.'),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Shipment details', exact: true }).click();
  await expect(page.getByText(/10.00 × 8 × 6 in/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Shipment details', exact: true }).click();
  await expect(page.getByText(/10.00 × 8 × 6 in/)).toBeVisible();
  await page.getByRole('link', { name: 'Copy to new comparison' }).click();
  for (const label of ['myUnishippers origin', 'myUnishippers receiver']) {
    await expect(page.getByLabel(`${label} contact name`, { exact: true })).toHaveValue(
      'Fixture Contact',
    );
    await expect(page.getByLabel(`${label} phone number`, { exact: true })).toHaveValue(
      '+1 (202) 555-0147',
    );
  }
  await expect(page.getByLabel('Group 1 length', { exact: true })).toHaveValue('10.00');
  await page.getByLabel('Group 1 length', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Save comparison', exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  expect(page.url()).not.toBe(original);
  await page.goto(original);
  await page.getByRole('button', { name: 'Shipment details', exact: true }).click();
  await expect(page.getByText(/10.00 × 8 × 6 in/)).toBeVisible();
});

test('saves a myUnishippers request comparison with blank dimensions', async ({ page }) => {
  await signIn(page);
  await page.goto('/quotes/new');
  await page.getByRole('checkbox', { name: 'Amazon Shipping', exact: true }).uncheck();
  await page.getByRole('combobox', { name: 'myUnishippers sender' }).click();
  await page.getByRole('option', { name: 'Explicit sender' }).click();
  for (const [label, values] of [
    [
      'myUnishippers origin',
      {
        name: 'US Spice Mills',
        street: '200 Regency Drive',
        city: 'Glendale Heights',
        'state / province': 'IL',
        postalCode: '60139',
      },
    ],
    [
      'Destination',
      {
        name: 'Marine Crisp',
        street: '20 Lithgow Street',
        city: 'Winslow',
        'state / province': 'ME',
        postalCode: '04901',
      },
    ],
  ] as const) {
    for (const [field, value] of Object.entries(values)) {
      if (field === 'state / province') {
        await page.getByRole('combobox', { name: `${label} ${field}`, exact: true }).click();
        await page
          .getByRole('option', { name: value === 'IL' ? 'Illinois' : 'Maine', exact: true })
          .click();
      } else {
        await page.getByLabel(`${label} ${field}`, { exact: true }).fill(value);
      }
    }
  }
  await page.getByLabel('Group 1 quantity', { exact: true }).fill('6');
  await page.getByLabel('Group 1 weight', { exact: true }).fill('51');

  await expect(page.getByText(/leave all three dimensions blank/i)).toBeVisible();
  await page.getByRole('button', { name: 'Save comparison', exact: true }).click();

  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Shipment details', exact: true }).click();
  await expect(page.getByText(/6 boxes · Dimensions not provided · 51 lb per box/)).toBeVisible();
  if (process.env.FE_TEST_QUOTE_DEMO === 'true')
    await expect(
      page.getByText(
        'No prices available. Review the provider messages below. These details are read-only.',
      ),
    ).toBeVisible({
      timeout: 15_000,
    });
});

test('streams partial success and retains it after reload through the real API', async ({
  page,
}) => {
  test.skip(process.env.FE_TEST_QUOTE_DEMO !== 'true', 'Opt-in isolated fixture worker required');
  await signIn(page);
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
  await expect(page.getByText(/12\.50 USD/)).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'The provider rejected these inputs.' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(/12\.50 USD/)).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'The provider rejected these inputs.' }),
  ).toBeVisible();
});
