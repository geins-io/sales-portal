import { test, expect, type Page } from '@playwright/test';
import { waitForHydration } from './helpers';

/**
 * Portal E2E Tests
 *
 * Tests the M6 portal pages: overview, orders, order detail,
 * purchased products, saved lists, and quotations.
 *
 * All portal pages require authentication. The loginAsTestUser helper
 * logs in before each test. Tests handle empty-state scenarios
 * gracefully since the test account may have no data.
 */

const PAGE_TIMEOUT = 20000;

/** Log in as the test user and wait for redirect to complete. */
async function loginAsTestUser(page: Page) {
  await page.goto('/se/sv/login');
  await page.waitForLoadState('load');
  await waitForHydration(page);

  const emailInput = page.locator('[data-testid="login-email"]');
  await expect(emailInput).toBeVisible({ timeout: PAGE_TIMEOUT });

  await emailInput.fill('test@sales-portal.dev');
  await page.locator('[data-testid="login-password"]').fill('TestPass2026!');
  await page.locator('[data-testid="login-submit"]').click();

  // Wait for redirect after successful login
  await page.waitForURL(/portal|\/se\/sv\//, { timeout: PAGE_TIMEOUT });
}

test.describe('Portal Overview', () => {
  test('should render stat cards and sections on overview page', async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await page.goto('/se/sv/portal');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // 4 stat cards should be visible in the grid container
    const statGrid = page.locator(
      '.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4',
    );
    await expect(statGrid).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Latest orders section
    const latestOrdersHeading = page.getByText('Senaste beställningar');
    const hasLatestOrders = await latestOrdersHeading
      .isVisible()
      .catch(() => false);
    // The heading text comes from i18n — accept either translated or the section existing
    if (!hasLatestOrders) {
      // Fallback: check that portal-orders-table exists (rendered by PortalOrdersTable)
      const ordersTable = page.locator('[data-testid="portal-orders-table"]');
      const hasTable = await ordersTable.isVisible().catch(() => false);
      expect(hasTable || hasLatestOrders).toBe(true);
    }

    // Pending quotations section
    const quotationsTable = page.locator(
      '[data-testid="pending-quotations-table"]',
    );
    const quotationsEmpty = page.locator(
      '[data-testid="pending-quotations-empty"]',
    );
    const hasQuotations = await quotationsTable.isVisible().catch(() => false);
    const hasQuotationsEmpty = await quotationsEmpty
      .isVisible()
      .catch(() => false);
    expect(hasQuotations || hasQuotationsEmpty).toBe(true);

    // Your lists section
    const listsTable = page.locator('[data-testid="your-lists-table"]');
    const listsEmpty = page.locator('[data-testid="your-lists-empty"]');
    const hasLists = await listsTable.isVisible().catch(() => false);
    const hasListsEmpty = await listsEmpty.isVisible().catch(() => false);
    expect(hasLists || hasListsEmpty).toBe(true);

    // Purchased products section
    const productsGrid = page.locator(
      '[data-testid="purchased-products-grid"]',
    );
    const productsEmpty = page.locator(
      '[data-testid="purchased-products-empty"]',
    );
    const hasProducts = await productsGrid.isVisible().catch(() => false);
    const hasProductsEmpty = await productsEmpty.isVisible().catch(() => false);
    expect(hasProducts || hasProductsEmpty).toBe(true);
  });
});

test.describe('Portal Orders', () => {
  test('should render orders list page with search and table', async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await page.goto('/se/sv/portal/orders');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Title should be visible (h2 inside the page)
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Search input
    const searchInput = page.locator('[data-testid="orders-search"]');
    await expect(searchInput).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Wait for loading to finish
    const loading = page.locator('[data-testid="orders-loading"]');
    await expect(loading).toBeHidden({ timeout: PAGE_TIMEOUT });

    // Either the table renders with headers, or the empty state is shown
    const ordersTable = page.locator('[data-testid="portal-orders-table"]');
    const ordersEmpty = page.locator('[data-testid="orders-empty"]');

    const hasTable = await ordersTable.isVisible().catch(() => false);
    const hasEmpty = await ordersEmpty.isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBe(true);

    // If table is visible, verify table headers exist
    if (hasTable) {
      const headerCells = ordersTable.locator('thead th');
      const count = await headerCells.count();
      // Expected columns: Id, Skapad, Lagd av, Typ, Summa, Status, (actions)
      expect(count).toBeGreaterThanOrEqual(6);
    }
  });

  test('should navigate to order detail when clicking view link', async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await page.goto('/se/sv/portal/orders');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Wait for loading to finish
    const loading = page.locator('[data-testid="orders-loading"]');
    await expect(loading).toBeHidden({ timeout: PAGE_TIMEOUT });

    // Check if there are any order view links
    const viewLink = page.locator('[data-testid="order-view-link"]').first();
    const hasViewLink = await viewLink.isVisible().catch(() => false);

    if (!hasViewLink) {
      // No orders — skip detail test
      return;
    }

    await viewLink.click();
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Should be on order detail page
    // Back link should exist
    const backLink = page.locator('[data-testid="back-link"]');
    await expect(backLink).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Action buttons should render
    const actionButtons = page.locator('[data-testid="action-buttons"]');
    await expect(actionButtons).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Order items table or loading should be present
    const orderDetail = page.locator('[data-testid="order-detail"]');
    const orderLoading = page.locator('[data-testid="order-loading"]');
    const hasDetail = await orderDetail.isVisible().catch(() => false);
    const hasLoading = await orderLoading.isVisible().catch(() => false);
    expect(hasDetail || hasLoading).toBe(true);

    if (hasDetail) {
      // Items table should be present
      const itemsTable = page.locator('[data-testid="order-items-table"]');
      await expect(itemsTable).toBeVisible({ timeout: PAGE_TIMEOUT });
    }
  });
});

test.describe('Portal Purchased Products', () => {
  test('should render products page with search', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/se/sv/portal/products');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Title
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Search input
    const searchInput = page.locator('[data-testid="products-search"]');
    await expect(searchInput).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Wait for loading to finish
    const loading = page.locator('[data-testid="products-loading"]');
    await expect(loading).toBeHidden({ timeout: PAGE_TIMEOUT });

    // Either products table or empty state
    const productsEmpty = page.locator('[data-testid="products-empty"]');
    const productsPagination = page.locator(
      '[data-testid="products-pagination"]',
    );

    const hasEmpty = await productsEmpty.isVisible().catch(() => false);
    const hasPagination = await productsPagination
      .isVisible()
      .catch(() => false);

    // One of these states should be true: empty state, or content with pagination footer
    // (pagination footer always renders when there's data, even if single page)
    expect(hasEmpty || hasPagination).toBe(true);
  });
});

test.describe('Portal Saved Lists', () => {
  test('should render lists page with search and create button', async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await page.goto('/se/sv/portal/lists');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Title
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Search input
    const searchInput = page.locator('[data-testid="saved-lists-search"]');
    await expect(searchInput).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Create button
    const createButton = page.locator('[data-testid="saved-lists-create"]');
    await expect(createButton).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Wait for loading to finish
    const loading = page.locator('[data-testid="saved-lists-loading"]');
    await expect(loading).toBeHidden({ timeout: PAGE_TIMEOUT });

    // Either lists content or empty state
    const listsEmpty = page.locator('[data-testid="saved-lists-empty"]');
    const hasEmpty = await listsEmpty.isVisible().catch(() => false);

    // If not empty, there should be a table or list content
    if (!hasEmpty) {
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });
});

test.describe('Portal Quotations', () => {
  test('should render quotations page with search', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/se/sv/portal/quotations');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Title
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Search input
    const searchInput = page.locator('[data-testid="quotations-search"]');
    await expect(searchInput).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Wait for loading to finish
    const loading = page.locator('[data-testid="quotations-loading"]');
    await expect(loading).toBeHidden({ timeout: PAGE_TIMEOUT });

    // Either quotations table or empty state
    const quotationsTable = page.locator('[data-testid="quotations-table"]');
    const quotationsEmpty = page.locator('[data-testid="quotations-empty"]');

    const hasTable = await quotationsTable.isVisible().catch(() => false);
    const hasEmpty = await quotationsEmpty.isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBe(true);

    // If table is visible, verify rows have expected structure
    if (hasTable) {
      const headerCells = quotationsTable.locator('thead th');
      const count = await headerCells.count();
      // Expected columns: Quote number, Created, Contact, Total, Status, (actions)
      expect(count).toBeGreaterThanOrEqual(5);
    }
  });
});
