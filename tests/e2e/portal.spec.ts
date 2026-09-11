import { test, expect, type Page } from '@playwright/test';
import {
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  fetchOrder,
  fetchOrders,
  parsePrice,
  readPrice,
  STORAGE_STATE,
  type ApiOrder,
} from './helpers';

/**
 * Portal E2E Tests
 *
 * Tests the M6 portal pages: overview, orders, order detail,
 * purchased products, saved lists, and quotations.
 *
 * All portal pages require authentication, so the file skips without a test
 * account. Tests handle empty states since the account may have no data.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'portal pages need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

// Per-test login would exceed the 5-per-minute login rate limit.
test.use({ storageState: STORAGE_STATE });

const PAGE_TIMEOUT = 20000;

test.describe('Portal Overview', () => {
  test('should render stat cards and sections on overview page', async ({
    page,
  }) => {
    await page.goto('/se/sv/portal');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // 4 stat cards should be visible in the grid container
    // (two columns on mobile, four on large screens)
    const statGrid = page.locator('.grid.grid-cols-2.lg\\:grid-cols-4');
    await expect(statGrid).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Latest orders section
    const latestOrdersHeading = page.getByText('Senaste beställningar');
    const hasLatestOrders = await latestOrdersHeading
      .isVisible()
      .catch(() => false);
    // The heading text comes from i18n — accept either translated or the section existing
    if (!hasLatestOrders) {
      // Fallback: the section renders PortalOrdersTable, whose wrapper sits on
      // the non-empty branch, so assert which of the two states rendered.
      // `hasTable || hasLatestOrders` could not fail — the second operand is
      // false by construction inside this branch, and the wrapper used to be
      // present at every state.
      const ordersTable = page.locator('[data-testid="portal-orders-table"]');
      const ordersEmpty = page.locator('[data-testid="orders-empty"]');
      const hasTable = await ordersTable.isVisible().catch(() => false);
      const hasEmpty = await ordersEmpty.isVisible().catch(() => false);
      expect(hasTable).not.toBe(hasEmpty);
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
    if (hasQuotations) {
      // The wrapper is on the non-empty branch, so its presence means rows.
      // Count the visible ones — both responsive shapes render N rows each.
      const rows = quotationsTable.locator(
        '[data-testid="pending-quote-row"]:visible',
      );
      expect(await rows.count()).toBeGreaterThan(0);
    }

    // Your lists section
    const listsTable = page.locator('[data-testid="your-lists-table"]');
    const listsEmpty = page.locator('[data-testid="your-lists-empty"]');
    const hasLists = await listsTable.isVisible().catch(() => false);
    const hasListsEmpty = await listsEmpty.isVisible().catch(() => false);
    expect(hasLists || hasListsEmpty).toBe(true);
    if (hasLists) {
      const rows = listsTable.locator('[data-testid="your-list-row"]:visible');
      expect(await rows.count()).toBeGreaterThan(0);
    }

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

    // Exactly one of the two: `portal-orders-table` wraps the non-empty
    // branch, so it exists only when the list has rows. The or-form accepted
    // either, and while the wrapper covered the empty state too it could not
    // fail at all.
    expect(hasTable).not.toBe(hasEmpty);

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
    await page.goto('/se/sv/portal/orders');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Wait for loading to finish
    const loading = page.locator('[data-testid="orders-loading"]');
    await expect(loading).toBeHidden({ timeout: PAGE_TIMEOUT });

    // The account owns orders, so an empty list is a broken fixture rather
    // than a scope boundary: `fixture-missing` means data the platform cannot
    // produce (helpers.ts), which an unseeded account is not. This used to
    // declare the skip and before that to `return`, and both hid the wrong
    // selector below for as long as no order existed.
    await expect(
      page.locator('[data-testid="portal-orders-table"]'),
      'the orders list rendered its empty state — the test account lost its orders',
    ).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Desktop puts a view link in the row, mobile makes the whole card the
    // link; both are anchors into the order, so match on the destination
    // rather than on a testid only the desktop one carries. Both shapes are in
    // the DOM at once and CSS decides which one shows, hence `:visible`.
    const orderLink = page
      .locator(
        '[data-testid="portal-orders-table"] a[href*="/portal/orders/"]:visible',
      )
      .first();
    await expect(orderLink).toBeVisible({ timeout: PAGE_TIMEOUT });
    await orderLink.click();
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Should be on order detail page
    // Back link should exist
    const backLink = page.locator('[data-testid="back-link"]');
    await expect(backLink).toBeVisible({ timeout: PAGE_TIMEOUT });

    // The toolbar carrying the back link and reorder button
    // (app/pages/portal/orders/[id].vue).
    const actionToolbar = page.locator('[data-testid="order-action-toolbar"]');
    await expect(actionToolbar).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Order items table or loading should be present
    const orderDetail = page.locator('[data-testid="order-detail"]');
    const orderLoading = page.locator('[data-testid="order-loading"]');
    const hasDetail = await orderDetail.isVisible().catch(() => false);
    const hasLoading = await orderLoading.isVisible().catch(() => false);
    expect(hasDetail || hasLoading).toBe(true);

    if (hasDetail) {
      // The order rows live in a desktop table (`hidden lg:block`) or, below
      // lg, behind a sheet trigger. Assert the one this project can see —
      // before the fixture existed this branch never ran on mobile, so the
      // desktop-only assertion looked fine.
      // Both are in the DOM at once, so match on visibility rather than DOM
      // order — the table comes first either way.
      const orderRows = page.locator(
        '[data-testid="order-items-table"]:visible, [data-testid="view-rows-trigger"]:visible',
      );
      await expect(orderRows.first()).toBeVisible({ timeout: PAGE_TIMEOUT });
    }
  });
});

/**
 * Portal Order Values
 *
 * Every amount on the orders surfaces, against the numbers the orders API
 * answered with. Numbers, never strings: the same order's total is
 * "1 125 kr" from the list endpoint and "1 125,00 kr" from the detail one, so
 * a string comparison across the two views fails on a correct application.
 *
 * Orders are chosen by what they contain — most lines, amounts that do not
 * terminate in two decimals — never by a fixed id, which would rot the day
 * the account is reseeded.
 */
test.describe('Portal Order Values', () => {
  /** What one rendered amount may be off by: the screen rounds to two decimals, the API does not. */
  const ROUNDING = 0.005;

  /** True for a number the screen cannot show exactly, e.g. 7.904 VAT. */
  function isUnrounded(value: number): boolean {
    return Math.abs(value * 100 - Math.round(value * 100)) > 1e-9;
  }

  function withMostLines(orders: ApiOrder[]): ApiOrder {
    return orders.reduce((a, b) => (b.items.length > a.items.length ? b : a));
  }

  /**
   * The order whose amounts do not terminate in two decimals. The screen must
   * round while the API does not, so this is where a rounding defect shows —
   * and where an assertion against the raw number without a tolerance would
   * fail a correct page.
   */
  function withUnroundedAmounts(orders: ApiOrder[]): ApiOrder | undefined {
    return orders.find(
      (order) =>
        isUnrounded(order.vat) ||
        isUnrounded(order.totalExVat) ||
        order.items.some(
          (line) =>
            isUnrounded(line.unitPriceIncVat) ||
            isUnrounded(line.totalPriceIncVat),
        ),
    );
  }

  /** How many lines of an order carry a quantity above one. */
  function multiQuantityLines(order: ApiOrder): number {
    return order.items.filter((line) => line.quantity > 1).length;
  }

  function withMostMultiQuantityLines(orders: ApiOrder[]): ApiOrder {
    return orders.reduce((a, b) =>
      multiQuantityLines(b) > multiQuantityLines(a) ? b : a,
    );
  }

  async function openOrdersList(page: Page) {
    await page.goto('/se/sv/portal/orders');
    await page.waitForLoadState('load');
    await waitForHydration(page);
    await expect(page.locator('[data-testid="orders-loading"]')).toBeHidden({
      timeout: PAGE_TIMEOUT,
    });
    await expect(
      page.locator('[data-testid="portal-orders-table"]'),
      'the orders list rendered its empty state — the test account lost its orders',
    ).toBeVisible({ timeout: PAGE_TIMEOUT });
  }

  async function openOrderDetail(page: Page, publicId: string) {
    await page.goto(`/se/sv/portal/orders/${publicId}`);
    await page.waitForLoadState('load');
    await waitForHydration(page);
    await expect(page.locator('[data-testid="order-detail"]')).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
  }

  /** One rendered order line: the three numbers a line shows. */
  interface ScreenLine {
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }

  /**
   * The lines as the running project can see them. Above `lg` they are the
   * desktop table; below it that table is hidden and the rows live in the
   * sheet behind `view-rows-trigger`. Both carry the same three numbers per
   * line, so no project has to leave the line assertions off.
   */
  async function readOrderLines(page: Page): Promise<ScreenLine[]> {
    const onDesktop = await page
      .locator('[data-testid="order-items-table"]')
      .isVisible()
      .catch(() => false);

    if (!onDesktop) {
      await page.locator('[data-testid="view-rows-trigger"]').click();
      await expect(page.locator('[data-testid="item-rows-sheet"]')).toBeVisible(
        {
          timeout: PAGE_TIMEOUT,
        },
      );
    }

    const prefix = onDesktop ? 'order-item' : 'item-rows';
    const rows = page.locator(
      onDesktop
        ? '[data-testid="order-item-row"]'
        : '[data-testid="item-rows-row"]',
    );

    const lines: ScreenLine[] = [];
    for (let index = 0; index < (await rows.count()); index++) {
      const row = rows.nth(index);
      const quantity = (
        await row.locator(`[data-testid="${prefix}-quantity"]`).innerText()
      ).trim();
      lines.push({
        quantity: Number(quantity),
        unitPrice: await readPrice(
          row.locator(`[data-testid="${prefix}-unit-price"]`),
        ),
        totalPrice: await readPrice(
          row.locator(`[data-testid="${prefix}-total-price"]`),
        ),
      });
      expect(
        Number.isFinite(lines[index]!.quantity),
        `line ${index} shows no quantity: ${JSON.stringify(quantity)}`,
      ).toBe(true);
    }
    return lines;
  }

  test('the list, the detail page and the API agree on an order total', async ({
    page,
  }) => {
    await openOrdersList(page);

    // Both list shapes are in the DOM at once and CSS decides which one shows.
    const row = page.locator('[data-testid="order-row"]:visible').first();
    await expect(row).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Desktop puts the link in a cell of the row, mobile makes the row itself
    // the link. Its href is what pairs the amount in this row with the order
    // the detail endpoint answers for: that endpoint keys on `publicId`, not
    // on the numeric id the row displays.
    const innerLink = row.locator('a[href*="/portal/orders/"]');
    const href = (await innerLink.count())
      ? await innerLink.first().getAttribute('href')
      : await row.getAttribute('href');
    const publicId = href?.split('/').filter(Boolean).pop();
    expect(publicId, `no order id in the row's link: ${href}`).toBeTruthy();

    const listTotal = await readPrice(
      row.locator('[data-testid="order-total"]'),
    );

    const api = await fetchOrder(page, publicId!);
    expect(listTotal).toBeCloseTo(api.totalIncVat, 2);

    await openOrderDetail(page, api.publicId);

    expect(
      await readPrice(page.locator('[data-testid="order-summary-total"]')),
    ).toBeCloseTo(api.totalIncVat, 2);

    // Two fields for one amount, both sent today. A page that reads either
    // must land on the same number.
    if (api.orderTotalIncVat !== undefined) {
      expect(api.orderTotalIncVat).toBeCloseTo(api.totalIncVat, 2);
    }

    // Ex-VAT reaches no cell on this page — subtotal, tax and total are all
    // inc-VAT strings — so the three amounts are held to each other where
    // ex-VAT exists at all, in the API's own numbers.
    expect(api.totalIncVat - api.totalExVat).toBeCloseTo(api.vat, 2);
    expect(
      await readPrice(page.locator('[data-testid="order-summary-tax"]')),
    ).toBeCloseTo(api.vat, 2);

    // Subtotal equals total on every order the account owns, because none
    // carries a shipping fee. The assertion holds the subtotal to the API,
    // but on this data it cannot tell the two cells apart: a passing run is
    // not evidence that the subtotal cell reads the subtotal.
    expect(
      await readPrice(page.locator('[data-testid="order-summary-subtotal"]')),
    ).toBeCloseTo(api.subTotalIncVat, 2);

    // No order has a priced shipping option, so the API sends an empty fee
    // string. Asserting the rendered fallback would assert the active locale;
    // the absence of a number is the assertion.
    const shipping = page.locator('[data-testid="order-summary-shipping"]');
    if (api.shippingFeeFormatted === '') {
      const text = (await shipping.innerText()).trim();
      expect(
        /\d/.test(text),
        `the API sent no shipping fee, so the cell must not show a number: ${JSON.stringify(text)}`,
      ).toBe(false);
    } else {
      expect(await readPrice(shipping)).toBeCloseTo(
        parsePrice(api.shippingFeeFormatted),
        2,
      );
    }

    // The desktop table repeats the total in its footer: two renderings of one
    // number on one page, which must not drift apart.
    const footerTotal = page.locator(
      '[data-testid="order-items-footer-total"]',
    );
    if (await footerTotal.isVisible().catch(() => false)) {
      expect(await readPrice(footerTotal)).toBeCloseTo(api.totalIncVat, 2);
    }
  });

  test('the line totals add up to the total the order shows', async ({
    page,
  }) => {
    const orders = await fetchOrders(page);
    const unrounded = withUnroundedAmounts(orders);
    expect(
      unrounded,
      'no order on the account has an amount that needs rounding, so the run ' +
        'cannot show a rounding defect. Place one with a price that does not ' +
        'terminate in two decimals.',
    ).toBeDefined();

    for (const api of [withMostLines(orders), unrounded!]) {
      const apiSum = api.items.reduce(
        (sum, line) => sum + line.totalPriceIncVat,
        0,
      );
      expect(apiSum).toBeCloseTo(api.totalIncVat, 2);

      await openOrderDetail(page, api.publicId);
      const lines = await readOrderLines(page);
      expect(lines.length).toBe(api.items.length);

      const screenTotal = await readPrice(
        page.locator('[data-testid="order-summary-total"]'),
      );
      const screenSum = lines.reduce((sum, line) => sum + line.totalPrice, 0);
      // Every rendered amount carries its own rounding, the total included.
      expect(Math.abs(screenSum - screenTotal)).toBeLessThanOrEqual(
        (lines.length + 1) * ROUNDING,
      );
    }
  });

  test('a line with a quantity above one shows quantity x unit price as its total', async ({
    page,
  }) => {
    const orders = await fetchOrders(page);
    const api = withMostMultiQuantityLines(orders);
    expect(
      multiQuantityLines(api),
      'every line on every order carries quantity 1. Orders used to arrive ' +
        'with their lines expanded that way, which makes the multiplication ' +
        'below unfalsifiable — three of a product must stay one line of three.',
    ).toBeGreaterThan(0);

    await openOrderDetail(page, api.publicId);
    const lines = await readOrderLines(page);
    expect(lines.length).toBe(api.items.length);

    for (const [index, line] of lines.entries()) {
      const apiLine = api.items[index]!;
      expect(line.quantity).toBe(apiLine.quantity);
      expect(line.unitPrice).toBeCloseTo(apiLine.unitPriceIncVat, 2);
      expect(line.totalPrice).toBeCloseTo(apiLine.totalPriceIncVat, 2);

      if (apiLine.quantity <= 1) continue;
      // The multiplication on both sides. On screen the tolerance grows with
      // the quantity: a unit price rounded to two decimals is multiplied by it.
      expect(
        Math.abs(line.totalPrice - line.unitPrice * line.quantity),
      ).toBeLessThanOrEqual((line.quantity + 1) * ROUNDING);
      expect(apiLine.totalPriceIncVat).toBeCloseTo(
        apiLine.unitPriceIncVat * apiLine.quantity,
        2,
      );
    }
  });
});

test.describe('Portal Purchased Products', () => {
  test('should render products page with search', async ({ page }) => {
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
  test('should render lists page with create button', async ({ page }) => {
    await page.goto('/se/sv/portal/lists');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Title
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible({ timeout: PAGE_TIMEOUT });

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

    // Exactly one of the two: `quotations-table` wraps the non-empty branch,
    // so it exists only when the list has rows. This states the invariant more
    // plainly than `hasTable || hasEmpty`; it does not catch more, since
    // `v-if` / `v-else` already makes both-true impossible. What the rows and
    // headers below assert is the part the old test never had.
    expect(hasTable).not.toBe(hasEmpty);

    if (hasTable) {
      // Both responsive shapes sit in the DOM at once and CSS decides which
      // one shows, so count what is visible. `md` is 768px (Tailwind), the
      // same breakpoint the page's `md:hidden` / `hidden md:block` use.
      const isNarrow = (page.viewportSize()?.width ?? 1280) < 768;

      const visibleRows = quotationsTable.locator(
        '[data-testid="quotation-row"]:visible',
      );
      expect(await visibleRows.count()).toBeGreaterThan(0);

      if (!isNarrow) {
        const headerCells = quotationsTable.locator('thead th:visible');
        const count = await headerCells.count();
        // Expected columns: Quote number, Created, Contact, Total, Status, (actions)
        expect(count).toBeGreaterThanOrEqual(5);
      }
    }
  });

  test('should navigate from list to populated detail page with all sections', async ({
    page,
  }) => {
    await page.goto('/se/sv/portal/quotations');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Wait for loading to finish
    const loading = page.locator('[data-testid="quotations-loading"]');
    await expect(loading).toBeHidden({ timeout: PAGE_TIMEOUT });

    // The test account has no quotes, because quotations are not functional on
    // the platform yet. Declared, not silently skipped.
    const empty = page.locator('[data-testid="quotations-empty"]');
    const hasEmpty = await empty.isVisible().catch(() => false);
    outOfScope(
      hasEmpty,
      'fixture-missing',
      'test account has no quotes — platform quotations are not available yet',
    );

    // Desktop puts a view link in the row, mobile makes the whole card the
    // link; both are anchors into the quote, so match on the destination
    // rather than on a testid only the desktop one carries. Both shapes are in
    // the DOM at once and CSS decides which one shows, hence `:visible` — the
    // old `.count()` branch saw the hidden desktop link on Mobile Chrome and
    // clicked something nothing renders.
    const quoteLink = page
      .locator(
        '[data-testid="quotations-table"] a[href*="/portal/quotations/"]:visible',
      )
      .first();
    await expect(quoteLink).toBeVisible({ timeout: PAGE_TIMEOUT });
    await quoteLink.click();

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

    // The line items render as a desktop table (`hidden lg:block`) or, below
    // lg, inside a sheet behind a trigger — the same split the order detail
    // page has. Assert the shape this project can actually see and count the
    // rows in it; the desktop-only assertion could not pass on Mobile Chrome.
    // `lg` is 1024px (Tailwind), the breakpoint the page itself branches on.
    const isNarrow = (page.viewportSize()?.width ?? 1280) < 1024;
    if (isNarrow) {
      const rowsTrigger = page.locator('[data-testid="view-rows-trigger"]');
      await expect(rowsTrigger).toBeVisible({ timeout: PAGE_TIMEOUT });
      await rowsTrigger.click();
      const sheetRows = page.locator('[data-testid="item-rows-row"]');
      await expect(sheetRows.first()).toBeVisible({ timeout: PAGE_TIMEOUT });
      expect(await sheetRows.count()).toBeGreaterThan(0);
      // Close it again: an open sheet covers the back link asserted below.
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="item-rows-sheet"]')).toBeHidden({
        timeout: PAGE_TIMEOUT,
      });
    } else {
      await expect(
        page.locator('[data-testid="line-items-table"]'),
      ).toBeVisible();
      const lineItemCount = await page
        .locator('[data-testid="line-item-row"]')
        .count();
      expect(lineItemCount).toBeGreaterThan(0);
    }

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
