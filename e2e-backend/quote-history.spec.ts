import { expect, type Page, test } from '@playwright/test';

async function signIn(page: Page, role: 'staff' | 'admin') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`frontend-${role}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(`${role} fixture password`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
}

test('staff retries immutable partial history; admins delete and restore it without running new rates', async ({
  page,
  browser,
}) => {
  test.skip(process.env.FE_TEST_QUOTE_RETRY !== 'true', 'Isolated retry fixture required');
  await signIn(page, 'staff');
  const api = `http://localhost:${process.env.FE_TEST_API_PORT ?? 3000}/api/v1/quote-comparisons`;
  const address = {
    name: 'History fixture',
    street: '1 Example Street',
    city: 'Walworth',
    division: 'WI',
    postalCode: '53125',
    country: 'US',
  };
  const input = {
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
  };
  const saved = await page.request.post(api, {
    headers: { Origin: 'http://localhost:4175' },
    data: input,
  });
  expect(saved.status()).toBe(201);
  const id = (await saved.json()).comparison.externalId;
  await page.goto(`/quotes/${id}`);
  await expect(
    page.getByText('Completed with partial results. These details are read-only.'),
  ).toBeVisible();
  await expect(page.getByText('Lowest price', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete comparison', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry myUnishippers', exact: true }).click();
  await page.getByRole('button', { name: 'Processing history', exact: true }).click();
  await expect(page.getByText('Attempt 2 · Mode: request', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'The provider request failed.' }),
  ).toHaveCount(1);
  await expect(page.getByText(/12\.50 USD/)).toBeVisible();
  const before = await (await page.request.get(`${api}/${id}`)).json();
  expect(before.input).toEqual(input);
  expect(before.attempts).toHaveLength(3);
  await page.reload();
  await page.getByRole('button', { name: 'Processing history', exact: true }).click();
  await expect(page.getByText('Attempt 2 · Mode: request', { exact: true })).toBeVisible();

  const context = await browser.newContext({ baseURL: 'http://localhost:4175' });
  try {
    const admin = await context.newPage();
    await signIn(admin, 'admin');
    await admin.goto(`/quotes/${id}`);
    await admin.getByRole('button', { name: 'Delete comparison', exact: true }).click();
    await admin.getByRole('button', { name: 'Confirm delete', exact: true }).click();
    await expect(
      admin.getByRole('button', { name: 'Restore comparison', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('The requested record is not available.', { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await admin.goto('/quotes');
    await admin.getByRole('link', { name: 'Deleted history', exact: true }).click();
    await expect(admin.getByText(/Deleted:/)).toBeVisible();
    await admin.getByRole('link', { name: 'View saved details', exact: true }).click();
    await admin.getByRole('button', { name: 'Restore comparison', exact: true }).click();
    await expect(admin.getByText(/Last restored:/)).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Processing history', exact: true }).click();
    await expect(page.getByText('Attempt 2 · Mode: request', { exact: true })).toBeVisible();
    const restored = await (await page.request.get(`${api}/${id}`)).json();
    expect(restored.attempts).toEqual(before.attempts);
    expect(restored.deletedAt).toBeNull();
    expect(restored.restoredAt).toEqual(expect.any(String));
  } finally {
    await context.close();
  }
});
