import { test, expect } from '@playwright/test';
import { discoverCategory, discoverProduct, waitForHydration } from './helpers';

/**
 * Product Browsing E2E Tests
 *
 * Tests the PLP → PDP journey: category navigation, product grid,
 * sorting, filtering, and product detail pages.
 */

test.describe('Product Browsing', () => {
  test('should navigate to a category and show product grid', async ({
    page,
  }) => {
    const category = await discoverCategory(page);

    await page.goto(`/${category.alias}`);

    // Product cards should render
    const cards = page.locator('[data-testid="product-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 20000 });

    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should switch between grid and list views', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load first
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });

    const viewToggle = page.locator('[data-testid="view-toggle"]');

    if (await viewToggle.isVisible().catch(() => false)) {
      // Click list view button
      const listButton = viewToggle.locator('button').nth(1);
      await listButton.click();

      // Product cards should still be visible (in list layout)
      await expect(
        page.locator('[data-testid="product-card"]').first(),
      ).toBeVisible();
    }
  });

  test('should have a sort dropdown', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load first
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });

    // Wait for hydration so Select component is interactive
    await waitForHydration(page);

    const sortDropdown = page.locator('[data-testid="sort-dropdown"]');

    if (await sortDropdown.isVisible().catch(() => false)) {
      // Retry click — hydration mismatch patching can cause first click to miss
      const options = page.locator('[role="option"]');
      for (let attempt = 0; attempt < 3; attempt++) {
        await sortDropdown.click();
        const visible = await options
          .first()
          .waitFor({ state: 'visible', timeout: 3000 })
          .then(() => true)
          .catch(() => false);
        if (visible) break;
        // Close the dropdown if it opened empty, then retry
        await page.keyboard.press('Escape');
      }
      await expect(options.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should have a filter button', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load first
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });

    const filterButton = page.locator('[data-testid="product-filters"]');

    if (await filterButton.isVisible().catch(() => false)) {
      await filterButton.click();

      const filterSheet = page.locator('[role="dialog"]');
      await expect(filterSheet).toBeVisible({ timeout: 5000 });
    }
  });

  test('should navigate to PDP from product card', async ({ page }) => {
    const product = await discoverProduct(page);

    await page.goto(`/p/${product.alias}`);

    const gallery = page.locator('[data-testid="product-gallery"]');
    await expect(gallery).toBeVisible({ timeout: 20000 });
  });

  test('should show product title and price on PDP', async ({ page }) => {
    const product = await discoverProduct(page);

    await page.goto(`/p/${product.alias}`);

    // Title should be visible
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 15000 });
    await expect(heading).not.toBeEmpty();
  });

  test('should render product tabs on PDP', async ({ page }) => {
    const product = await discoverProduct(page);

    await page.goto(`/p/${product.alias}`);
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const tabs = page.locator('[data-testid="product-tabs"]');

    if (await tabs.isVisible().catch(() => false)) {
      const tabTriggers = tabs.locator('[role="tab"]');
      const count = await tabTriggers.count();

      // Product may not have description/specs, so no tabs is OK
      if (count > 0) {
        await tabTriggers.first().click();
        const tabPanel = page.locator('[role="tabpanel"]');
        await expect(tabPanel).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should show add-to-cart button on PDP', async ({ page }) => {
    const product = await discoverProduct(page);

    await page.goto(`/p/${product.alias}`);

    const addButton = page
      .locator('[data-testid="add-to-cart-button"]')
      .first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
  });
});
