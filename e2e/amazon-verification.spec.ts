import { expect, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

const id = '11111111-1111-4111-8111-111111111111';
const attemptId = '22222222-2222-4222-8222-222222222222';
const frame = '33333333-3333-4333-8333-333333333333';
const address = {
  name: 'Fixture warehouse',
  street: '1 Example St',
  city: 'Walworth',
  division: 'WI',
  postalCode: '53125',
  country: 'US',
};

test('staff solve a verification challenge and retry the same quote on desktop and mobile', async ({
  page,
  context,
}, testInfo) => {
  await installLiveFixture(page);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
  const imagePage = await context.newPage();
  await imagePage.setContent(
    '<div style="width:400px;height:180px;font:18px sans-serif;padding:20px;box-sizing:border-box;background:#fff"><strong>Verification test</strong><p>Click the verification control.</p><button style="padding:12px">Verify fixture</button></div>',
  );
  const image = (await imagePage.locator('div').screenshot()).toString('base64');
  await imagePage.close();
  let solved = false;
  let retries = 0;
  let cancellations = 0;
  const value = {
    externalId: id,
    status: 'failed',
    ratesRun: true,
    createdAt: '2026-10-22T00:00:00.000Z',
    createdBy: id,
    input: {
      idempotencyKey: frame,
      shipDate: '2099-10-22',
      destination: address,
      providers: [
        {
          code: 'amazon',
          sender: { mode: 'explicit', address },
          options: { signature: 'none', insurance: null },
        },
      ],
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
    senders: [],
    warnings: [],
    attempts: [
      {
        externalId: attemptId,
        provider: 'amazon',
        status: 'failed',
        attemptNumber: 1,
        executionMode: 'request',
        startedAt: null,
        completedAt: null,
        recoveryCount: 0,
        outcome: 'failed',
        reasonCode: 'verification_required',
        retryBlockedReason: null,
        simulated: false,
        quotes: [],
      },
    ],
  };
  await page.route(`**/api/v1/quote-comparisons/${id}`, (route) => route.fulfill({ json: value }));
  await page.route(
    `**/api/v1/quote-comparisons/${id}/attempts/${attemptId}/amazon-verification`,
    (route) => {
      const command = route.request().postDataJSON();
      expect(command.owner).toBeUndefined();
      if (command.operation === 'cancel') cancellations++;
      if (command.operation === 'action') {
        expect(command.action).toMatchObject({ type: 'click', frame });
        expect(command.action.x).toBeGreaterThanOrEqual(0);
        expect(command.action.x).toBeLessThanOrEqual(1);
        solved = true;
      }
      return route.fulfill({
        json: {
          id: frame,
          state:
            command.operation === 'cancel'
              ? 'cancelled'
              : command.operation === 'action'
                ? 'preparing'
                : solved
                  ? 'verified'
                  : 'challenge',
          expiresAt: '2099-10-22T00:00:00.000Z',
          ...(!solved ? { frame, image, width: 400, height: 180 } : {}),
        },
      });
    },
  );
  await page.route(`**/api/v1/quote-comparisons/${id}/attempts/${attemptId}/retry`, (route) => {
    expect(solved).toBe(true);
    retries++;
    return route.fulfill({ json: value });
  });
  await page.goto(`/quotes/${id}`);
  await page.getByRole('button', { name: 'Verify Amazon & retry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Verify Amazon & retry' });
  const challenge = dialog.getByRole('button', { name: 'Amazon verification challenge' });
  await expect(challenge).toBeEnabled();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('staff-verification.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await challenge.click({ position: { x: 30, y: 100 } });
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => retries).toBe(1);
  await expect.poll(() => cancellations).toBe(1);
});
