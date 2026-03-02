import { test, expect } from '@playwright/test';
import { expectNoConsoleErrors } from './helpers';

/**
 * Homepage E2E Tests
 *
 * Tests the startpage CMS content, banner rendering, and general page structure.
 */

test.describe('Homepage', () => {
  test('should load without console errors', async ({ page }) => {
    await expectNoConsoleErrors(page, async () => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
    });
  });

  test('should render at least one CMS widget', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const widgets = page.locator('[data-testid="cms-widget"]');
    await expect(widgets.first()).toBeVisible({ timeout: 15000 });

    const count = await widgets.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should load banner images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find images within CMS widgets
    const widgetImages = page.locator('[data-testid="cms-widget"] img');
    const count = await widgetImages.count();

    if (count > 0) {
      // Check the first banner image loaded (naturalWidth > 0)
      const firstImage = widgetImages.first();
      await expect(firstImage).toBeVisible({ timeout: 10000 });

      const naturalWidth = await firstImage.evaluate(
        (img: HTMLImageElement) => img.naturalWidth,
      );
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });

  test('should render navigation header with menu links', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    const headerLinks = header.locator('a[href]');
    const count = await headerLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should render footer with sections', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Footer should have links
    const footerLinks = footer.locator('a[href]');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});
