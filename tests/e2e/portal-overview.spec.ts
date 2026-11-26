import { test, expect, type Page } from './fixtures';
import {
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  signedInState,
} from './helpers';
import { apiGet } from './api-call';
import { PAGE_TIMEOUT, fetchPendingQuoteIds } from './portal-shared';

/**
 * Portal E2E Tests: the overview and the purchased products.
 *
 * The other portal areas have their own portal-*.spec.ts files, so the CI legs
 * can share the portal out. All portal pages require authentication, so the
 * file skips without a test account. Tests handle empty states since the
 * account may have no data.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'portal pages need a signed-in customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

// Per-test login would exceed the 5-per-minute login rate limit.
test.use({ storageState: signedInState });

test.describe('Portal Overview', () => {
  test('should render stat cards and sections on overview page', async ({
    page,
  }) => {
    // The quotations section can render empty first and swap in the rows
    // later, so the data decides which state to wait for.
    const pendingQuoteIds = await fetchPendingQuoteIds(page);

    await page.goto('/se/sv/portal');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // 4 stat cards should be visible in the grid container
    // (two columns on mobile, four on large screens)
    const statGrid = page.locator('.grid.grid-cols-2.lg\\:grid-cols-4');
    await expect(statGrid).toBeVisible({ timeout: PAGE_TIMEOUT });

    // Latest orders section. This used to sit inside `if (!hasLatestOrders)`,
    // guarded by a lookup for the section heading — a branch that never runs,
    // because the heading does render, so the assertion below never executed.
    // PortalOrdersTable's wrapper sits on the non-empty branch and
    // `orders-empty` on the other, so exactly one of the two is in the DOM;
    // the strict `or()` fails when both are.
    const ordersTable = page.locator('[data-testid="portal-orders-table"]');
    const ordersEmpty = page.locator('[data-testid="orders-empty"]');
    await expect(ordersTable.or(ordersEmpty)).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });

    // Pending quotations section: at most the five newest pending ones.
    const quotationsTable = page.locator(
      '[data-testid="pending-quotations-table"]',
    );
    const quotationsEmpty = page.locator(
      '[data-testid="pending-quotations-empty"]',
    );
    if (pendingQuoteIds.length > 0) {
      await expect(quotationsTable).toBeVisible({ timeout: PAGE_TIMEOUT });
      await expect(quotationsEmpty).toBeHidden();
      // Both responsive shapes render N rows each; count the visible ones.
      await expect(
        quotationsTable.locator('[data-testid="pending-quote-row"]:visible'),
      ).toHaveCount(Math.min(pendingQuoteIds.length, 5));
    } else {
      await expect(quotationsEmpty).toBeVisible({ timeout: PAGE_TIMEOUT });
      await expect(quotationsTable).toBeHidden();
    }

    // Your lists section. Lists come from localStorage through a client
    // plugin that runs before hydration ends, so the state has settled here.
    const listsTable = page.locator('[data-testid="your-lists-table"]');
    const listsEmpty = page.locator('[data-testid="your-lists-empty"]');
    await expect(listsTable.or(listsEmpty)).toBeVisible({
      timeout: PAGE_TIMEOUT,
    });
    if (await listsTable.isVisible()) {
      await expect(
        listsTable.locator('[data-testid="your-list-row"]:visible').first(),
      ).toBeVisible();
    }

    // Purchased products section. The account has purchased products (measured
    // against /api/orders/products), so the empty state is not a state this
    // tenant reaches and `hasProducts || hasProductsEmpty` accepted it anyway.
    const productsGrid = page.locator(
      '[data-testid="purchased-products-grid"]',
    );
    const productsEmpty = page.locator(
      '[data-testid="purchased-products-empty"]',
    );
    await expect(productsGrid).toBeVisible({ timeout: PAGE_TIMEOUT });
    await expect(productsEmpty).toBeHidden();
  });

  test('the overview arrives with its pending quotations and does not read them again', async ({
    page,
  }) => {
    const listed = await apiGet(page.request, '/api/quotes/overview');
    expect(listed.ok(), '/api/quotes/overview did not answer 200').toBe(true);
    const { total: pending } = (await listed.json()) as { total: number };
    outOfScope(
      pending === 0,
      'fixture-missing',
      'the test account has no pending quotation to show on the overview',
    );

    const clientReads: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/quotes')) {
        clientReads.push(request.url());
      }
    });

    const response = await page.goto('/se/sv/portal');
    const html = (await response?.text()) ?? '';
    // Each row renders twice, as a mobile card and a desktop table row, and
    // the overview shows at most five.
    const rows = html.match(/data-testid="pending-quote-row"/g) ?? [];
    expect(rows).toHaveLength(2 * Math.min(pending, 5));

    await waitForHydration(page);
    expect(clientReads).toEqual([]);
  });

  // Each page waits for the part that settles last: a width taken before it
  // renders would pass for the wrong reason.
  for (const { path, ready } of [
    { path: '/se/sv/portal', ready: '[data-testid="overview-stats"]' },
    {
      path: '/se/sv/portal/orders',
      ready:
        '[data-testid="portal-orders-table"], [data-testid="orders-empty"]',
    },
    {
      path: '/se/sv/portal/quotations',
      ready:
        '[data-testid="quotations-table"], [data-testid="quotations-empty"]',
    },
  ]) {
    test(`${path} is no wider than a 390 or a 360 px phone screen`, async ({
      page,
    }) => {
      for (const width of [390, 360]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(path);
        await page.waitForLoadState('load');
        await waitForHydration(page);
        await expect(page.locator(ready).first()).toBeVisible({
          timeout: PAGE_TIMEOUT,
        });
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth, `page width at a ${width} px viewport`).toBe(
          clientWidth,
        );
      }
    });
  }
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

    // The account has purchased products, so the pagination footer is the
    // state this tenant reaches — it renders whenever there is data, even on a
    // single page. `hasEmpty || hasPagination` accepted the empty list too.
    const productsEmpty = page.locator('[data-testid="products-empty"]');
    const productsPagination = page.locator(
      '[data-testid="products-pagination"]',
    );

    await expect(productsPagination).toBeVisible({ timeout: PAGE_TIMEOUT });
    await expect(productsEmpty).toBeHidden();
  });

  type ListedProduct = {
    name: string;
    articleNumber: string;
    alias?: string | null;
    totalQuantity: number;
    latestOrderId: string;
    latestOrderPublicId: string | null;
  };

  async function fetchPurchasedProducts(page: Page) {
    const response = await apiGet(page.request, '/api/orders/products');
    expect(response.ok(), '/api/orders/products did not answer 200').toBe(true);
    return (await response.json()) as {
      products: ListedProduct[];
      total: number;
    };
  }

  test("the start page's own read agrees with the whole list", async ({
    page,
  }) => {
    const list = await fetchPurchasedProducts(page);
    const response = await apiGet(
      page.request,
      '/api/orders/products/overview',
    );
    expect(
      response.ok(),
      '/api/orders/products/overview did not answer 200',
    ).toBe(true);
    const overview = (await response.json()) as {
      products: { articleNumber: string }[];
      total: number;
      mostPurchasedName: string | null;
    };

    // Newest first in both; a tie for the most bought goes to the newer.
    const mostBought = list.products.reduce((a, b) =>
      a.totalQuantity >= b.totalQuantity ? a : b,
    );
    expect(overview.total).toBe(list.total);
    expect(overview.products.map((p) => p.articleNumber)).toEqual(
      list.products.slice(0, 4).map((p) => p.articleNumber),
    );
    expect(overview.mostPurchasedName).toBe(mostBought.name);
  });

  test("a bought product's page links to the newest order holding it", async ({
    page,
  }) => {
    const [newest] = (await fetchPurchasedProducts(page)).products;
    outOfScope(
      !newest?.alias || !newest.latestOrderPublicId,
      'fixture-missing',
      'the test account has no bought product with a page and an order link',
    );
    if (!newest?.alias || !newest.latestOrderPublicId) return;

    await page.goto(`/se/sv/p/${newest.alias}`);
    await waitForHydration(page);

    const row = page.locator('[data-testid="pdp-latest-ordered"]');
    await expect(row).toBeVisible({ timeout: PAGE_TIMEOUT });
    await expect(row).toContainText(`(${newest.latestOrderId})`);
    await expect(row).toHaveAttribute(
      'href',
      `/se/sv/portal/orders/${newest.latestOrderPublicId}`,
    );
  });
});
