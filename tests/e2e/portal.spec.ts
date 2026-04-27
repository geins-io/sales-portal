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

    // Saved lists are entirely client-side (SDK ListsSession in
    // localStorage). On a fresh test browser the user has no lists yet,
    // so the empty state is what should show. No server roundtrip and
    // therefore no loading state.
    const listsEmpty = page.locator('[data-testid="saved-lists-empty"]');
    await expect(listsEmpty).toBeVisible({ timeout: PAGE_TIMEOUT });
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

  test('should navigate from list to populated detail page with all sections', async ({
    page,
  }) => {
    await loginAsTestUser(page);
    await page.goto('/se/sv/portal/quotations');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Wait for loading to finish
    const loading = page.locator('[data-testid="quotations-loading"]');
    await expect(loading).toBeHidden({ timeout: PAGE_TIMEOUT });

    // Skip if the test account has no quotes (empty state — data drift tolerant)
    const empty = page.locator('[data-testid="quotations-empty"]');
    const hasEmpty = await empty.isVisible().catch(() => false);
    test.skip(hasEmpty, 'Test account has no quotes — fixture required');

    // Click the first view link (desktop table preferred, falls back to mobile card)
    const viewLink = page
      .locator('[data-testid="quotation-view-link"]')
      .first();
    const quotationRow = page.locator('[data-testid="quotation-row"]').first();
    const linkCount = await viewLink.count();
    if (linkCount > 0) {
      await viewLink.click();
    } else {
      await quotationRow.click();
    }

    // Wait for navigation to the locale-prefixed detail URL (uuid segment)
    await page.waitForURL(/\/se\/sv\/portal\/quotations\/[\w-]+/, {
      timeout: PAGE_TIMEOUT,
    });

    // Detail page landed — must NOT be the 404 fallback
    const detail = page.locator('[data-testid="quote-detail"]');
    await expect(detail).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Core header: back link, title, status badge
    await expect(page.locator('[data-testid="back-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="quote-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-badge"]')).toBeVisible();

    // Items table with at least one line item row
    await expect(
      page.locator('[data-testid="line-items-table"]'),
    ).toBeVisible();
    const lineItemCount = await page
      .locator('[data-testid="line-item-row"]')
      .count();
    expect(lineItemCount).toBeGreaterThan(0);

    // Sidebar summary
    await expect(page.locator('[data-testid="quote-summary"]')).toBeVisible();

    // Sidebar info blocks — customer info + sale contact are always rendered
    await expect(page.locator('[data-testid="customer-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="sale-contact"]')).toBeVisible();

    // Address blocks — may be absent depending on quotation data, soft check
    const invoiceAddress = page.locator('[data-testid="invoice-address"]');
    const deliveryAddress = page.locator('[data-testid="delivery-address"]');
    const hasInvoice = await invoiceAddress.isVisible().catch(() => false);
    const hasDelivery = await deliveryAddress.isVisible().catch(() => false);
    // At least one address block should render when the quote has billing data
    expect(hasInvoice || hasDelivery).toBe(true);

    // Accept/Decline buttons only for pending quotes — presence is acceptable
    // but we NEVER click them (mutating the real backend is out of scope)
    const acceptBtn = page.locator('[data-testid="accept-btn"]');
    const declineBtn = page.locator('[data-testid="decline-btn"]');
    const hasAccept = await acceptBtn.isVisible().catch(() => false);
    if (hasAccept) {
      await expect(acceptBtn).toBeEnabled();
      await expect(declineBtn).toBeVisible();
      await expect(declineBtn).toBeEnabled();
    }

    // Back link round-trip — returns to list
    await page.locator('[data-testid="back-link"]').click();
    await page.waitForURL(/\/se\/sv\/portal\/quotations\/?$/, {
      timeout: PAGE_TIMEOUT,
    });
    await expect(page.locator('[data-testid="quotations-table"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  });
});
