import { test, expect, type Page, type Response } from './fixtures';
import {
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  fetchOrder,
  fetchOrders,
  readPrice,
  setVatDisplay,
  signedInState,
  type ApiOrder,
} from './helpers';
import { apiGet } from './api-call';
import { PAGE_TIMEOUT, readItemLines, TWO_DECIMALS } from './portal-shared';

/**
 * Portal E2E Tests: the order list, the order page and their amounts.
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

/** A page of the order list as `/api/orders` answers it. */
interface OrderListRead {
  orders: { id: number; publicId?: string }[];
  total: number;
}

/** The next read of the order list whose query `match` takes. */
function nextOrderListRead(
  page: Page,
  match: (query: URLSearchParams) => boolean,
): Promise<Response> {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/orders' &&
      response.request().method() === 'GET' &&
      match(url.searchParams)
    );
  });
}

/**
 * Opens the order list from the overview, so the browser makes the list's
 * reads itself, and answers its first page.
 */
async function openOrderList(page: Page): Promise<OrderListRead> {
  await page.goto('/se/sv/portal');
  await page.waitForLoadState('load');
  await waitForHydration(page);

  const listRead = nextOrderListRead(page, () => true);
  await page
    .locator('[data-testid="portal-tabs"] a[href$="/portal/orders"]')
    .click();
  const list = await listRead;
  expect(list.ok(), '/api/orders did not answer 200').toBe(true);
  return (await list.json()) as OrderListRead;
}

/** The order numbers of the rows the list shows, in order. */
function orderRowIds(page: Page): Promise<(string | null)[]> {
  return page
    .locator('[data-testid="order-row"]:visible')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-id')));
}

test.describe('Portal Orders', () => {
  test('the order list reads its first page and pages past 20 on the server', async ({
    page,
  }) => {
    const first = await openOrderList(page);
    outOfScope(
      first.total <= 20,
      'fixture-missing',
      'the test account has 20 orders or fewer, so the list has one page',
    );

    const summary = page.locator('[data-testid="orders-showing-count"]');
    await expect(summary).toHaveAttribute('data-total', String(first.total));
    await expect(summary).toHaveAttribute('data-shown', '20');
    await expect
      .poll(() => orderRowIds(page))
      .toEqual(first.orders.map((order) => String(order.id)));
    // Newest first is the only order: nothing offers another.
    await expect(page.locator('[data-testid="sort-created"]')).toHaveCount(0);

    const next = nextOrderListRead(page, (query) => query.get('skip') === '20');
    await page.locator('[data-testid="orders-next"]').click();
    const response = await next;
    expect(new URL(response.url()).searchParams.get('take')).toBe('20');
    const second = (await response.json()) as OrderListRead;

    expect(second.orders.length).toBeGreaterThan(0);
    await expect
      .poll(() => orderRowIds(page))
      .toEqual(second.orders.map((order) => String(order.id)));
  });

  test('the search box searches the order number on the server', async ({
    page,
  }) => {
    const first = await openOrderList(page);
    const sample = first.orders.find((order) => String(order.id).length >= 4);
    outOfScope(
      !sample,
      'fixture-missing',
      'no order on the first page has a number of four digits or more',
    );
    // Part of the number, from inside it: Geins matches anywhere in it.
    const term = String(sample!.id).slice(1, 4);
    const search = page.locator('[data-testid="orders-search"]');
    await expect(search).toHaveAttribute('placeholder', 'Sök på ordernummer');

    const searched = nextOrderListRead(
      page,
      (query) => query.get('search') === term,
    );
    await search.fill(term);
    const response = await searched;
    expect(new URL(response.url()).searchParams.get('skip')).toBe('0');
    const found = (await response.json()) as OrderListRead;

    expect(found.orders.map((order) => order.id)).toContain(sample!.id);
    for (const order of found.orders) {
      expect(String(order.id)).toContain(term);
    }
    await expect
      .poll(() => orderRowIds(page))
      .toEqual(found.orders.map((order) => String(order.id)));
  });

  test("Visa bara mina reads the buyer's own orders, and off again the company's", async ({
    page,
  }) => {
    const company = await openOrderList(page);
    await expect
      .poll(() => orderRowIds(page))
      .toEqual(company.orders.map((order) => String(order.id)));
    const summary = page.locator('[data-testid="orders-showing-count"]');
    const mine = page.locator('[data-testid="orders-mine"]');
    await expect(mine).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('Visa bara mina')).toBeVisible();

    const ownRead = nextOrderListRead(
      page,
      (query) => query.get('mine') === 'true',
    );
    await mine.click();
    const own = (await (await ownRead).json()) as OrderListRead;

    expect(own.total).toBeLessThanOrEqual(company.total);
    await expect(mine).toHaveAttribute('aria-checked', 'true');
    // The pager, and the count in it, show only past one page.
    await expect(summary).toHaveCount(own.total > 20 ? 1 : 0);
    if (own.total > 20) {
      await expect(summary).toHaveAttribute('data-total', String(own.total));
    }
    await expect
      .poll(() => orderRowIds(page))
      .toEqual(own.orders.map((order) => String(order.id)));

    const backRead = nextOrderListRead(page, (query) => !query.has('mine'));
    await mine.click();
    const back = (await (await backRead).json()) as OrderListRead;
    expect(back.total).toBe(company.total);
    await expect
      .poll(() => orderRowIds(page))
      .toEqual(back.orders.map((order) => String(order.id)));
  });

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

    if (hasTable) {
      // Both responsive shapes sit in the DOM at once and CSS decides which
      // one shows, so count what is visible. `md` is 768px (Tailwind), the
      // same breakpoint the table's `md:hidden` / `hidden md:table` use.
      // Without the branch, `thead th` counted the desktop headers on Mobile
      // Chrome too, where none of them is rendered.
      const isNarrow = (page.viewportSize()?.width ?? 1280) < 768;

      const visibleRows = ordersTable.locator(
        '[data-testid="order-row"]:visible',
      );
      expect(await visibleRows.count()).toBeGreaterThan(0);

      if (!isNarrow) {
        const headerCells = ordersTable.locator('thead th:visible');
        const count = await headerCells.count();
        // Expected columns: Id, Skapad, Lagd av, Typ, Summa, Status, (actions)
        expect(count).toBeGreaterThanOrEqual(6);
      }
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

    // The detail page finishes loading. `hasDetail || hasLoading` accepted one
    // that never did, and put the row assertion below inside `if (hasDetail)`,
    // so a page stuck on its spinner passed without a row ever being read.
    const orderDetail = page.locator('[data-testid="order-detail"]');
    const orderLoading = page.locator('[data-testid="order-loading"]');
    await expect(orderDetail).toBeVisible({ timeout: PAGE_TIMEOUT });
    await expect(orderLoading).toBeHidden();

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
  });
});

/**
 * Portal Order Values
 *
 * Every amount on the orders surfaces, against the numbers the orders API
 * answered with. Numbers, never strings: the screen rounds to two decimals,
 * the API does not.
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

  for (const side of ['ex', 'inc'] as const) {
    test(`the list, the detail page and the API agree on an order total, ${side} VAT`, async ({
      page,
    }) => {
      await setVatDisplay(page, side);
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
      await expect(row.locator('[data-testid="order-total"]')).toHaveText(
        TWO_DECIMALS,
      );

      const api = await fetchOrder(page, publicId!);
      const inc = side === 'inc';
      const total = inc ? api.totalIncVat : api.totalExVat;
      const otherTotal = inc ? api.totalExVat : api.totalIncVat;
      expect(listTotal).toBeCloseTo(total, 2);
      if (api.vat > 0) expect(listTotal).not.toBeCloseTo(otherTotal, 2);

      await openOrderDetail(page, api.publicId);

      expect(
        await readPrice(page.locator('[data-testid="order-summary-total"]')),
      ).toBeCloseTo(total, 2);

      // Two fields for one amount, both sent today. A page that reads either
      // must land on the same number.
      const orderTotal = inc ? api.orderTotalIncVat : api.orderTotalExVat;
      if (orderTotal !== undefined) {
        expect(orderTotal).toBeCloseTo(total, 2);
      }

      // VAT is one number in both modes, and it is what separates the two
      // totals in the API's own numbers.
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
      ).toBeCloseTo(inc ? api.subTotalIncVat : api.subTotalExVat, 2);

      // A shipping row only when the order carries a fee, decided on the
      // number with the page's own fallback: the cart summary's fee, then the
      // order's. A formatted "0,00 kr" is no fee.
      const rawOrder = (
        await (await apiGet(page.request, `/api/orders/${publicId}`)).json()
      )?.order;
      const shippingAmount: number | undefined = inc
        ? (rawOrder?.cart?.summary?.shipping?.feeIncVat ??
          rawOrder?.shippingFee?.sellingPriceIncVat)
        : (rawOrder?.cart?.summary?.shipping?.feeExVat ??
          rawOrder?.shippingFee?.sellingPriceExVat);
      const shipping = page.locator('[data-testid="order-summary-shipping"]');
      if ((shippingAmount ?? 0) > 0) {
        expect(await readPrice(shipping)).toBeCloseTo(shippingAmount!, 2);
      } else {
        await expect(
          shipping,
          'the order carries no shipping fee, so the order page must show no shipping row',
        ).toHaveCount(0);
      }

      // The desktop table repeats the total in its footer: two renderings of one
      // number on one page, which must not drift apart.
      const footerTotal = page.locator(
        '[data-testid="order-items-footer-total"]',
      );
      if (await footerTotal.isVisible().catch(() => false)) {
        expect(await readPrice(footerTotal)).toBeCloseTo(total, 2);
      }
    });
  }

  // The two rounding tests below read the inc side: the account's orders were
  // seeded so that the inc amounts need rounding.
  test('the line totals add up to the total the order shows', async ({
    page,
  }) => {
    await setVatDisplay(page, 'inc');
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
      const lines = await readItemLines(page);
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
    await setVatDisplay(page, 'inc');
    const orders = await fetchOrders(page);
    const api = withMostMultiQuantityLines(orders);
    expect(
      multiQuantityLines(api),
      'every line on every order carries quantity 1. Orders used to arrive ' +
        'with their lines expanded that way, which makes the multiplication ' +
        'below unfalsifiable — three of a product must stay one line of three.',
    ).toBeGreaterThan(0);

    await openOrderDetail(page, api.publicId);
    const lines = await readItemLines(page);
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
