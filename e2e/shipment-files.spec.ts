import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { installUpcomingFixture } from './upcoming-fixture';

test('shipment files refresh links, preview, download, retry and empty state', async ({
  page,
}, testInfo) => {
  await installUpcomingFixture(page);
  let reads = 0;
  let failure = false;
  let empty = false;
  await page.route('**/api/v1/upcoming-shipments/*/files', (route) => {
    reads++;
    return failure
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({
          json: {
            files: empty
              ? []
              : [
                  {
                    id: 'attExample',
                    filename: 'Packing list.png',
                    type: 'image/png',
                    size: 12000,
                    url: `https://v5.airtableusercontent.com/fixture-${reads}.png`,
                  },
                ],
          },
        });
  });
  await page.context().route('https://v5.airtableusercontent.com/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.goto('/upcoming-shipments');
  await page.getByRole('button', { name: '2026-11-18, 25 orders', exact: true }).click();
  await page.locator('[data-order-id]').first().click();
  const files = page.getByRole('region', { name: 'Shipment files' });
  await expect(files.getByText('Packing list.png')).toBeVisible();
  if (process.env.UPDATE_HELP_SCREENSHOTS === 'true' && testInfo.project.name === 'chromium') {
    const dialog = page.getByRole('dialog');
    await files.scrollIntoViewIfNeeded();
    const box = await dialog.boundingBox();
    if (!box) throw new Error('Missing dialog');
    const targets = [
      files.getByRole('heading', { name: 'Files' }),
      files.getByRole('button', { name: 'Preview' }),
      files.getByRole('button', { name: 'Download' }),
    ];
    const markers = [];
    for (const target of targets) {
      const bounds = await target.boundingBox();
      if (!bounds) throw new Error('Missing marker');
      markers.push({
        x: ((bounds.x + bounds.width / 2 - box.x) / box.width) * 100,
        y: ((bounds.y + bounds.height / 2 - box.y) / box.height) * 100,
      });
    }
    await dialog.screenshot({
      path: 'public/help/screenshots/upcoming-files.png',
      animations: 'disabled',
    });
    const captures = JSON.parse(await readFile('src/features/help/captures.json', 'utf8'));
    captures['upcoming-files'] = {
      width: Math.round(box.width),
      height: Math.round(box.height),
      markers,
    };
    await writeFile('src/features/help/captures.json', `${JSON.stringify(captures, null, 2)}\n`);
  }
  await files.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog', { name: 'Packing list.png' });
  await expect(preview.getByRole('img')).toHaveAttribute('src', /fixture-2/);
  await expect(preview.getByRole('img')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(files).toBeVisible();
  const popupPromise = page.waitForEvent('popup');
  await files.getByRole('button', { name: 'Download' }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/fixture-3/);
  await popup.close();
  failure = true;
  await files.getByRole('button', { name: 'Preview' }).click();
  await expect(files.getByRole('alert')).toBeVisible();
  failure = false;
  empty = true;
  await files.getByRole('button', { name: 'Retry' }).click();
  await expect(files.getByText('No files attached to this shipment.')).toBeVisible();
});
