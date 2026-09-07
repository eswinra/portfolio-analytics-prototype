import { expect, test } from '@playwright/test';

/** Visual regression (local QA, run on demand with `npm run test:visual`): full-page renders of
 *  the surfaces a monthly update changes — the fiscal-year Overview, the CIO Monthly tab, the
 *  deck's first two slides — compared against baselines kept under outputs/visual-snapshots
 *  (ignored by git, platform-specific). Refresh baselines deliberately with
 *  `npm run test:visual:update` after reviewing the diff. Not part of the default suite. */

test.describe('visual baselines', () => {
  test('overview', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('#view-title')).toBeVisible();
    await expect(page).toHaveScreenshot('overview.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.005,
    });
  });

  test('cio monthly — latest report', async ({ page }) => {
    await page.goto('/#/cio');
    await expect(page.getByText(/Monthly vintage/)).toBeVisible();
    await expect(page).toHaveScreenshot('cio-latest.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.005,
    });
  });

  test('deck — executive read and fund at a glance', async ({ page }) => {
    await page.goto('/deck/');
    await expect(page.locator('#s1-title')).toContainText('Executive read');
    // let the count-up tiles settle before comparing
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('deck-slide-1.png', { maxDiffPixelRatio: 0.005 });
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('deck-slide-2.png', { maxDiffPixelRatio: 0.005 });
  });
});
