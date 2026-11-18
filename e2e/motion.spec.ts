import { expect, type Locator, test } from '@playwright/test';
import { accountFixture } from '@test/auth-fixture';
import { installLiveFixture } from './live-fixture';

async function expectMotion(element: Locator, reduced: boolean) {
  await expect(element).toBeVisible();
  // Inspect the applied transition, not wall-clock timing on a busy test runner.
  await expect
    .poll(() =>
      element.evaluate((node) =>
        Math.max(...getComputedStyle(node).transitionDuration.split(',').map(parseFloat)),
      ),
    )
    .toBe(reduced ? 0.00001 : 0.32);
  if (reduced) {
    // MUI's lifecycle timing must also be zero, beyond the CSS safety override.
    await expect
      .poll(() =>
        element.evaluate((node) =>
          Math.max(...(node as HTMLElement).style.transitionDuration.split(',').map(parseFloat)),
        ),
      )
      .toBe(0);
  }
}

for (const reduced of [false, true]) {
  test(`shared motion respects ${reduced ? 'reduced' : 'normal'} motion and restores focus`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await installLiveFixture(page);
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: accountFixture }));
    await page.goto('/help');

    const accordion = page.locator('.MuiAccordion-root').first();
    const summary = accordion.locator('.MuiAccordionSummary-root');
    await summary.click();
    await expect(summary).toHaveAttribute('aria-expanded', 'false');
    await summary.click();
    await expectMotion(accordion.locator('.MuiCollapse-root'), reduced);

    const enlarge = page.getByRole('button', { name: 'Enlarge screenshot: Read your dashboard' });
    await enlarge.click();
    const dialog = page.getByRole('dialog', { name: 'Read your dashboard' });
    await expectMotion(page.locator('.MuiDialog-container'), reduced);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(enlarge).toBeFocused();

    const theme = page.getByRole('button', { name: /Choose theme/ }).filter({ visible: true });
    await theme.click();
    await expectMotion(page.locator('.MuiMenu-paper'), reduced);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(theme).toBeFocused();

    const mobile = (page.viewportSize()?.width ?? 0) < 900;
    if (mobile) await page.getByRole('button', { name: 'Open navigation' }).click();
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    if (mobile) await expectMotion(page.locator('#mobile-navigation .MuiDrawer-paper'), reduced);
    const shipments = navigation.getByRole('button', { name: 'Shipments', exact: true });
    await shipments.click();
    await expect(shipments).toHaveAttribute('aria-expanded', 'false');
    await shipments.click();
    await expectMotion(navigation.locator('.MuiCollapse-root'), reduced);
    if (mobile) {
      await page.keyboard.press('Escape');
      await expect(navigation).toBeHidden();
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
