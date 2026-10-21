import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

test.beforeEach(async ({ page }) => {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  await page.route('**/api/v1/quote-comparisons/providers', (route) =>
    route.fulfill({
      json: [
        {
          code: 'unishippers',
          name: 'myUnishippers',
          enabled: true,
          executionMode: 'request',
          usedInternationally: false,
          internationalAvailable: false,
          supportsSignature: false,
          supportsInsurance: false,
        },
      ],
    }),
  );
  // Deterministic SDK fixture: no API key or customer address reaches Google.
  await page.route(/https:\/\/.*(googleapis|gstatic)\.com\//, (route) => route.abort());
  await page.addInitScript(() => {
    const component = (type: string, longText: string, shortText = longText) => ({
      types: [type],
      longText,
      shortText,
    });
    Object.defineProperty(window, 'google', {
      configurable: true,
      value: {
        maps: {
          importLibrary: async () => ({
            AutocompleteSessionToken: class {},
            AutocompleteSuggestion: {
              fetchAutocompleteSuggestions: async ({ input }: { input: string }) => {
                if (input.includes('fail')) throw new Error('Synthetic failure');
                return {
                  suggestions: [
                    {
                      placePrediction: {
                        placeId: 'example',
                        text: { toString: () => '123 Example Street, Brooklyn, NY 11201' },
                        toPlace: () => ({
                          fetchFields: async () => ({}),
                          addressComponents: [
                            component('country', 'United States', 'US'),
                            component('street_number', '123'),
                            component('route', 'Example Street'),
                            component('locality', 'Brooklyn'),
                            component('administrative_area_level_1', 'New York', 'NY'),
                            component('postal_code', '11201'),
                          ],
                        }),
                      },
                    },
                  ],
                };
              },
            },
          }),
        },
      },
    });
  });
  await page.goto('/quotes/new');
});

test('selects both addresses, preserves manual contacts and supports corrections', async ({
  page,
}) => {
  for (const label of ['Sender', 'Recipient']) {
    const search = page.getByRole('combobox', { name: `${label} address search` });
    await search.fill('123 Example');
    await expect(page.getByRole('option')).toBeVisible();
    await expect(page.getByText('Google Maps', { exact: true })).toBeVisible();
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(page.getByLabel(`${label} address`, { exact: false })).toHaveValue(
      '123 Example Street',
    );
    await expect(page.getByLabel(`${label} city`, { exact: false })).toHaveValue('Brooklyn');
    await expect(page.getByLabel(`${label} ZIP / postal code`, { exact: false })).toHaveValue(
      '11201',
    );
    await expect(page.getByRole('combobox', { name: `${label} state / province` })).toHaveText(
      'New York',
    );
    await page.getByLabel(`${label} company or name`, { exact: false }).fill(`Manual ${label}`);
    await page.getByLabel(`${label} apartment / suite (optional)`).fill('Suite 2');
    await page.getByRole('button', { name: `${label}: Search for another address` }).click();
    await page.getByRole('combobox', { name: `${label} address search` }).fill('123 Example');
    await page.getByRole('option').click();
    await expect(page.getByLabel(`${label} company or name`, { exact: false })).toHaveValue(
      `Manual ${label}`,
    );
    await expect(page.getByLabel(`${label} apartment / suite (optional)`)).toHaveValue('Suite 2');
    await page.getByLabel(`${label} address`, { exact: false }).fill('124 Corrected Street');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('allows manual entry after Google failure and never submits the search text as an address', async ({
  page,
}) => {
  await page.getByRole('combobox', { name: 'Recipient address search' }).fill('fail lookup');
  await expect(
    page.getByText('Address search is unavailable. Enter the address manually.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Recipient: Enter address manually' }).click();
  await expect(page.getByLabel('Recipient address', { exact: false })).toHaveValue('');
  await page.getByLabel('Recipient address', { exact: false }).fill('45 Manual Road');
  await expect(page.getByLabel('Recipient address', { exact: false })).toHaveValue(
    '45 Manual Road',
  );
});
