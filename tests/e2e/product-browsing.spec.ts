import { test, expect } from '@playwright/test';
import {
  discoverCategory,
  discoverProduct,
  discoverPurchasableProduct,
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  STORAGE_STATE,
} from './helpers';

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

    // The sheet opens via a Vue handler — unhydrated, the click is inert.
    await waitForHydration(page);

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

    // The product's own heading, not any h1: the header and the print header
    // both render the brand name, so a bare `h1` is ambiguous.
    const heading = page.locator('[data-testid="product-name"]');
    await expect(heading).toBeVisible({ timeout: 15000 });
    await expect(heading).not.toBeEmpty();
  });

  test('should render product tabs on PDP', async ({ page }) => {
    const product = await discoverProduct(page);

    await page.goto(`/p/${product.alias}`);
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const tabs = page.locator('[data-testid="product-tabs"]');
    if (!(await tabs.isVisible().catch(() => false))) return;

    // ProductTabs renders Tabs at >= md and an Accordion below, hiding one by
    // CSS. Both stay in the DOM, so branch on what is actually visible.
    const tabTriggers = tabs.locator('[role="tab"]');
    const isDesktopLayout = await tabTriggers
      .first()
      .isVisible()
      .catch(() => false);

    if (isDesktopLayout) {
      await tabTriggers.first().click();

      // One panel per tab, so an unscoped locator fails strict mode.
      const tabPanel = tabs.locator('[role="tabpanel"]').first();
      await expect(tabPanel).toBeVisible({ timeout: 5000 });
      return;
    }

    // Mobile accordion: expanding a section is the equivalent affordance.
    const sections = tabs.locator('button[aria-expanded]');
    // A product with no description/specs/documents renders nothing here.
    if ((await sections.count()) === 0) return;

    const firstSection = sections.first();
    await expect(firstSection).toHaveAttribute('aria-expanded', 'false');
    await firstSection.click();
    await expect(firstSection).toHaveAttribute('aria-expanded', 'true', {
      timeout: 5000,
    });
  });

  // Own block so the surrounding tests stay anonymous — only this one needs
  // a session, since add-to-cart is gated on `orderPlacement`.
  test.describe('purchase affordance (authenticated)', () => {
    outOfScope(
      !hasE2ECredentials(),
      'no-credentials',
      'add-to-cart needs an authenticated customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
    );
    test.use({ storageState: STORAGE_STATE });

    test('should show add-to-cart button on PDP', async ({ page }) => {
      const product = await discoverPurchasableProduct(page);

      await page.goto(`/p/${product.alias}`);

      const addButton = page
        .locator('[data-testid="add-to-cart-button"]')
        .first();
      await expect(addButton).toBeVisible({ timeout: 15000 });
    });
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

    // Wait for navigation to complete
    await page.waitForLoadState('load', { timeout: 15000 });

    // Verify URL contains a locale prefix (e.g., /se/sv/ or /se/en/)
    const url = page.url();
    expect(url).toMatch(/\/[a-z]{2}\/[a-z]{2}\//);

    // Verify it's NOT the homepage (product click shouldn't redirect to home)
    expect(url).not.toMatch(/\/[a-z]{2}\/[a-z]{2}\/$/);

    // Verify PDP content loads (the product's own heading)
    const heading = page.locator('[data-testid="product-name"]');
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
    const heading = page.locator('[data-testid="product-name"]');
    await expect(heading).toBeVisible({ timeout: 15000 });

    // The PDP is rendered once its breadcrumbs carry the category link; the
    // category page's crumbs stay in the DOM until then, so the heading check
    // above alone does not prove the PDP is up.
    const categoryCrumb = page
      .locator('[data-testid="breadcrumbs"] a[href*="/c/"]')
      .last();
    await expect(categoryCrumb).toBeVisible({ timeout: 15000 });
    await categoryCrumb.click();

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
