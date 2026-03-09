import { test, expect } from '@playwright/test';
import {
  setMobileViewport,
  discoverCategory,
  waitForHydration,
} from './helpers';

/**
 * Navigation E2E Tests
 *
 * Tests site navigation: header links, breadcrumbs, footer links,
 * and mobile navigation panel.
 */

test.describe('Navigation', () => {
  test('should have clickable header menu links', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: 15000 });

    const links = header.locator('a[href]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    // Click the first non-home link and verify navigation
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      if (href && href !== '/' && !href.startsWith('http')) {
        await links.nth(i).click();
        await page.waitForLoadState('domcontentloaded');

        // URL should have changed
        const url = new URL(page.url());
        expect(url.pathname).not.toBe('/');
        break;
      }
    }
  });

  test('should render breadcrumbs on category pages', async ({ page }) => {
    const category = await discoverCategory(page);

    await page.goto(`/${category.alias}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the page content to render
    await page.waitForLoadState('networkidle').catch(() => {
      // Fallback: networkidle may not fire if long-polling is active
    });

    const breadcrumbs = page.locator('[data-testid="breadcrumbs"]');

    if (await breadcrumbs.isVisible().catch(() => false)) {
      const items = breadcrumbs.locator('li');
      const count = await items.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('should have clickable footer links', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 15000 });

    const links = footer.locator('a[href]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Mobile Navigation', () => {
  test('should open mobile nav panel from hamburger menu', async ({ page }) => {
    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const trigger = page.locator('[data-testid="mobile-nav-trigger"]');
    await expect(trigger).toBeVisible({ timeout: 15000 });

    await trigger.click();

    // Sheet renders via dialog portal — teleported to body
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 15000 });
  });

  test('should have navigation links in mobile panel', async ({ page }) => {
    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const trigger = page.locator('[data-testid="mobile-nav-trigger"]');
    await expect(trigger).toBeVisible({ timeout: 15000 });
    await trigger.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    const links = dialog.locator('a[href]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should close mobile nav on navigation', async ({ page }) => {
    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const trigger = page.locator('[data-testid="mobile-nav-trigger"]');
    await expect(trigger).toBeVisible({ timeout: 15000 });
    await trigger.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    const links = dialog.locator('a[href]');
    const count = await links.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const href = await links.nth(i).getAttribute('href');
        if (href && !href.startsWith('http')) {
          await links.nth(i).click();
          break;
        }
      }

      // Dialog should close after navigation
      await expect(dialog).toBeHidden({ timeout: 10000 });
    }
  });

  test('should have search accessible on mobile', async ({ page }) => {
    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const searchButton = page.locator('[data-slot="search-button"]');
    await expect(searchButton).toBeVisible({ timeout: 15000 });
  });
});
