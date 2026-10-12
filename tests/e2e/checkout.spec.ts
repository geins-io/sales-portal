import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  addToCart,
  discoverPurchasableProduct,
  fetchCart,
  hasE2ECredentials,
  outOfScope,
  parsePrice,
  readPrice,
  setVatDisplay,
  waitForHydration,
  signedInState,
  type ApiCart,
  type VatSide,
} from './helpers';

/**
 * Checkout E2E Tests
 *
 * The last step where a buyer sees a number before committing. The summary and
 * the line list render `cartStore.cart` — the very object `/api/cart` returns,
 * since `/api/checkout` supplies addresses and payment/shipping options only.
 * So this asserts that the cart the server computed survives to the final
 * screen, not that two computations agree.
 *
 * Every amount follows the buyer's VAT choice, as on /cart. Each test runs on
 * both sides and asserts the side it set and, where VAT is non-zero, that the
 * other side's number is *not* what reached the screen.
 *
 * Nothing here places an order: no test clicks the place-order button, and the
 * guard below fails any test that reaches an order-creating endpoint anyway.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'checkout is gated on orderPlacement, which is authenticated-only here (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: signedInState });

test.describe('Checkout summary', () => {
  // More than one, or "quantity x unit price" is not a multiplication.
  const QUANTITY = 3;

  /**
   * Every request that would create something. `create-order` places the
   * order, `quotes` turns the cart into a quote, and `token` hands the cart to
   * the hosted flow — the ticket stops before all three. Asserted rather than
   * assumed: "the spec creates no order" is otherwise a claim about code
   * nobody re-reads.
   */
  const ORDER_CREATING = [
    '/api/checkout/create-order',
    '/api/quotes',
    '/api/checkout/token',
  ];

  // Collected rather than thrown from the listener: an exception raised inside
  // a Playwright event handler is not awaited by the test and can pass
  // unnoticed. Tests in a file run one at a time per worker, so one array is
  // enough.
  let created: string[] = [];

  test.beforeEach(async ({ page }) => {
    created = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (
        request.method() === 'POST' &&
        ORDER_CREATING.some((endpoint) => path.endsWith(endpoint))
      ) {
        created.push(path);
      }
    });
  });

  test.afterEach(() => {
    expect(
      created,
      'this spec must create nothing, but it posted to an order-creating endpoint',
    ).toEqual([]);
  });

  /**
   * A cart with a known quantity, then the checkout page it feeds.
   *
   * The page redirects to /cart without a cart cookie and renders the summary
   * from the store the cart plugin hydrates during SSR, so the wait is for the
   * summary itself rather than for the network.
   */
  async function openCheckout(page: Page, side: VatSide) {
    await setVatDisplay(page, side);
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias, QUANTITY);

    await page.goto('/checkout');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // A tenant in hosted mode redirects away from here, and an /api/checkout
    // failure renders an error card instead of the summary. Both would
    // otherwise surface as a confusing "element not found" further down.
    await expect(
      page.locator('[data-testid="checkout-order-summary"]'),
      'the custom checkout summary did not render — hosted mode, or /api/checkout failed',
    ).toBeVisible({ timeout: 20000 });

    const cart = await fetchCart(page);
    expect(
      cart.items[0]!.quantity,
      'the checkout is showing a different cart than the one this test built',
    ).toBe(QUANTITY);
    return cart;
  }

  /**
   * Shipping has no number before an option is selected: `/api/cart` sends an
   * empty fee string and the summary leaves the cell empty by design, so
   * nothing on the last screen reads as a fee that was never quoted.
   *
   * The cell is asserted as present-and-numberless rather than visible: an
   * element with no content has no box, which Playwright reports as hidden.
   * The summary's other numbers are read on the same page, so this absence is
   * never the whole of what the test saw.
   */
  async function expectShippingMatches(cell: Locator, feeFormatted: string) {
    if (feeFormatted === '') {
      await expect(cell).toHaveCount(1);
      const text = ((await cell.textContent()) ?? '').trim();
      expect(
        /\d/.test(text),
        `the API sent no shipping fee, so the cell must not show a number: ${JSON.stringify(text)}`,
      ).toBe(false);
      return;
    }

    await expect(cell).toBeVisible();
    expect(await readPrice(cell)).toBeCloseTo(parsePrice(feeFormatted), 2);
  }

  /** The cart's amounts on one VAT side, and the other side's to deny. */
  function sideOf(cart: ApiCart, side: VatSide) {
    const inc = side === 'inc';
    return {
      subtotal: inc ? cart.subTotalIncVat : cart.subTotalExVat,
      total: inc ? cart.totalIncVat : cart.totalExVat,
      otherSubtotal: inc ? cart.subTotalExVat : cart.subTotalIncVat,
      otherTotal: inc ? cart.totalExVat : cart.totalIncVat,
      shippingFeeFormatted: inc
        ? cart.shippingFeeFormatted
        : cart.shippingFeeExVatFormatted,
      discount: inc ? cart.discountIncVat : cart.discountExVat,
    };
  }

  for (const side of ['ex', 'inc'] as const) {
    test(`the summary shows the ${side}-VAT numbers /api/cart reports`, async ({
      page,
    }) => {
      const cart = await openCheckout(page, side);
      const expected = sideOf(cart, side);

      const subtotal = await readPrice(
        page.locator('[data-testid="checkout-summary-subtotal"]'),
      );
      const total = await readPrice(
        page.locator('[data-testid="checkout-summary-total"]'),
      );

      expect(subtotal).toBeCloseTo(expected.subtotal, 2);
      expect(total).toBeCloseTo(expected.total, 2);
      // VAT is one number in both modes.
      expect(
        await readPrice(page.locator('[data-testid="checkout-summary-tax"]')),
      ).toBeCloseTo(cart.vat, 2);

      // The other side. Without this the test would pass just as well on a
      // checkout that ignored the choice and showed one side always.
      if (cart.vat > 0) {
        expect(subtotal).not.toBeCloseTo(expected.otherSubtotal, 2);
        expect(total).not.toBeCloseTo(expected.otherTotal, 2);
      }

      await expectShippingMatches(
        page.locator('[data-testid="checkout-summary-shipping"]'),
        expected.shippingFeeFormatted,
      );
    });

    test(`each line shows the ${side}-VAT unit price and total`, async ({
      page,
    }) => {
      const cart = await openCheckout(page, side);
      const line = cart.items[0]!;
      const inc = side === 'inc';
      const unitExpected = inc ? line.unitPriceIncVat : line.unitPriceExVat;
      const totalExpected = inc ? line.totalPriceIncVat : line.totalPriceExVat;
      const unitOther = inc ? line.unitPriceExVat : line.unitPriceIncVat;

      const item = page.locator('[data-testid="checkout-cart-item"]').first();
      // The unit-price id sits on the paragraph that also carries the "/ unit"
      // suffix. That text has no digits, so the price is the only number in it.
      const unitPrice = await readPrice(
        item.locator('[data-testid="checkout-unit-price"]'),
      );
      const lineTotal = await readPrice(
        item.locator('[data-testid="checkout-line-total"]'),
      );

      expect(unitPrice).toBeCloseTo(unitExpected, 2);
      expect(lineTotal).toBeCloseTo(totalExpected, 2);
      // The multiplication itself, on both sides.
      expect(lineTotal).toBeCloseTo(unitPrice * QUANTITY, 2);
      expect(totalExpected).toBeCloseTo(unitExpected * QUANTITY, 2);

      if (unitExpected !== unitOther) {
        expect(unitPrice).not.toBeCloseTo(unitOther, 2);
      }
    });

    test(`the cart and the checkout show the same ${side}-VAT total`, async ({
      page,
    }) => {
      const cart = await openCheckout(page, side);
      const checkoutTotal = await readPrice(
        page.locator('[data-testid="checkout-summary-total"]'),
      );

      await page.goto('/cart');
      await page.waitForLoadState('load');
      await waitForHydration(page);
      const cartTotal = page.locator('[data-testid="cart-summary-total"]');
      await expect(cartTotal).toBeVisible({ timeout: 20000 });

      expect(await readPrice(cartTotal)).toBeCloseTo(checkoutTotal, 2);
      expect(checkoutTotal).toBeCloseTo(sideOf(cart, side).total, 2);
    });
  }

  test('removing the last line switches the page to the empty-cart state', async ({
    page,
  }) => {
    await openCheckout(page, 'ex');

    // Removed one row at a time, waiting for each removal to land: that is the
    // buyer's path, and it covers both "one by one" and "all of them".
    const rows = page.locator('[data-testid="checkout-cart-item"]');
    for (let remaining = await rows.count(); remaining > 0; remaining--) {
      await page
        .locator('[data-testid="checkout-remove-item"]')
        .first()
        .click();
      await expect(rows).toHaveCount(remaining - 1);
    }

    await expect(page.locator('[data-testid="checkout-empty"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(
      page.locator('[data-testid="checkout-order-summary"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="place-order-button"]'),
    ).toHaveCount(0);
  });

  test('the discount line carries what the API reports', async ({ page }) => {
    const cart = await openCheckout(page, 'ex');

    // Asserting a zero here would pass whether or not the line works, so the
    // empty case is declared rather than asserted. The day the tenant carries
    // a promotion this becomes a real assertion instead of a skip.
    outOfScope(
      cart.discountExVat === 0,
      'tenant-config',
      'the tenant has no promotion, so the discount line never carries a value',
    );

    const discountRow = page.locator(
      '[data-testid="checkout-summary-discount"]',
    );
    await expect(discountRow).toBeVisible();
    expect(
      await readPrice(
        discountRow.locator('[data-testid="checkout-summary-discount-amount"]'),
      ),
    ).toBeCloseTo(cart.discountExVat, 2);
  });
});
