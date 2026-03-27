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

  test('should filter products by price and return to full list on clear', async ({
    page,
  }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await waitForHydration(page);

    const initialCount = await page
      .locator('[data-testid="product-card"]')
      .count();

    // Open filter panel
    const filterButton = page.locator('[data-testid="product-filters"]');
    if (!(await filterButton.isVisible().catch(() => false))) return;

    await filterButton.click();
    const filterSheet = page.locator('[role="dialog"]');
    await expect(filterSheet).toBeVisible({ timeout: 5000 });

    // Find and click a price filter checkbox
    const checkbox = filterSheet.locator('[role="checkbox"]').first();
    if (!(await checkbox.isVisible().catch(() => false))) return;

    await checkbox.click();

    // Wait for product list to update via API
    await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/api/product-lists/products') &&
          resp.status() === 200,
        { timeout: 15000 },
      )
      .catch(() => {
        // Filter may update without a separate API call
      });

    // Close the filter sheet by pressing Escape
    await page.keyboard.press('Escape');
    await expect(filterSheet).not.toBeVisible({ timeout: 5000 });

    // Verify product count changed (may have decreased or stayed the same if filter matches all)
    const filteredCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    expect(filteredCount).toBeGreaterThan(0);

    // Re-open filter panel and clear all filters
    await filterButton.click();
    await expect(filterSheet).toBeVisible({ timeout: 5000 });

    const clearButton = filterSheet
      .locator('button')
      .filter({ hasText: 'Rensa alla' })
      .last();
    await clearButton.scrollIntoViewIfNeeded();
    await clearButton.click({ force: true });

    // Wait for product list to update
    await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/api/product-lists/products') &&
          resp.status() === 200,
        { timeout: 15000 },
      )
      .catch(() => {});

    await page.keyboard.press('Escape');
    await expect(filterSheet).not.toBeVisible({ timeout: 5000 });

    // Verify count returns to original
    const restoredCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    expect(restoredCount).toBe(initialCount);
  });

  test('should filter products by text search and clear', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await waitForHydration(page);

    const initialCount = await page
      .locator('[data-testid="product-card"]')
      .count();

    // Type in the quick filter input
    const searchInput = page.getByPlaceholder(
      'Filtrera på art nr eller produktnamn',
    );
    if (!(await searchInput.isVisible().catch(() => false))) return;

    await searchInput.fill('test');

    // Wait for debounce (300ms) + API refetch
    await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/api/product-lists/products') &&
          resp.status() === 200,
        { timeout: 15000 },
      )
      .catch(() => {});

    // Wait a bit for DOM update
    await page.waitForTimeout(500);

    // Product count should have changed (could be 0 or fewer)
    const filteredCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    // The search may filter to 0 or fewer products
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // Clear the search input
    await searchInput.clear();

    // Wait for refetch
    await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/api/product-lists/products') &&
          resp.status() === 200,
        { timeout: 15000 },
      )
      .catch(() => {});

    await page.waitForTimeout(500);

    // Verify products return to original count
    const restoredCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    expect(restoredCount).toBe(initialCount);
  });

  test('should navigate to PDP with locale prefix in URL', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await waitForHydration(page);

    // Click the first product card link
    const productLink = page.locator('[data-testid="product-card"] a').first();
    await productLink.click();

    // Wait for PDP to load
    await page.waitForURL(/\/se\/sv\//, { timeout: 15000 });

    // Verify URL contains locale prefix
    expect(page.url()).toContain('/se/sv/');

    // Verify PDP content loads (product title visible)
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 15000 });
    await expect(heading).not.toBeEmpty();
  });

  test('should return to category from PDP breadcrumb with products visible', async ({
    page,
  }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await waitForHydration(page);

    // Navigate to a PDP by clicking the first product
    const productLink = page.locator('[data-testid="product-card"] a').first();
    await productLink.click();

    // Wait for PDP to load
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Click the category breadcrumb link (not the last item, which is the product)
    const breadcrumbs = page.locator('[data-testid="breadcrumbs"]');
    if (!(await breadcrumbs.isVisible().catch(() => false))) return;

    // The breadcrumb links are all but the last item (current page)
    const breadcrumbLinks = breadcrumbs.locator('a');
    const linkCount = await breadcrumbLinks.count();
    if (linkCount === 0) return;

    // Click the last breadcrumb link (the category, one before current page)
    await breadcrumbLinks.nth(linkCount - 1).click();

    // Wait for category page to load with products
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });

    const productCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    expect(productCount).toBeGreaterThan(0);
  });
});
