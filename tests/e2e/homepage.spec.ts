import { test, expect } from '@playwright/test';
import { expectNoConsoleErrors } from './helpers';

/**
 * Homepage E2E Tests
 *
 * Tests page structure and navigation. CMS content tests are covered
 * by unit tests — E2E skips them since the Geins API may be
 * unreachable from CI runners.
 */

test.describe('Homepage', () => {
  test('should load without console errors', async ({ page }) => {
    await expectNoConsoleErrors(page, async () => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
    });
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

    const footerLinks = footer.locator('a[href]');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});
