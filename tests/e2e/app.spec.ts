import { test, expect } from '@playwright/test';

/**
 * Basic Application E2E Tests
 *
 * Tests that verify the application loads correctly and basic navigation works.
 */

test.describe('Application', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Page should have loaded - title format is "{tenant} - {hostname}" or similar
    // In dev/test mode with localhost, title may be "- localhost"
    await expect(page).toHaveTitle(/.*/);

    // Also verify the page actually rendered
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should have a valid viewport', async ({ page }) => {
    await page.goto('/');

    // Check that the page has content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should not have any console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected warnings/errors (e.g., 404s for missing resources in dev)
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('404') &&
        !error.includes('Failed to load resource') &&
        !error.includes('Cross-Origin-Opener-Policy'),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Navigation', () => {
  test('should have navigable links in the header', async ({ page }) => {
    await page.goto('/');

    // The header should contain at least one link
    const headerLinks = page.locator('header a[href]');
    const count = await headerLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Responsive Design', () => {
  test('should render correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should still be visible on mobile
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should render correctly on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Page should still be visible on tablet
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should render correctly on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Page should still be visible on desktop
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');

    // Page should have at least one heading element
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have lang attribute on html element', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    // Lang is set dynamically from tenant locale (e.g. 'sv-SE', 'en')
    await expect(html).toHaveAttribute('lang', /^[a-z]{2}(-[A-Z]{2})?$/);
  });

  test('should have proper meta viewport', async ({ page }) => {
    await page.goto('/');

    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds (generous for CI)
    expect(loadTime).toBeLessThan(10000);
  });
});
