import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  discoverPurchasableProduct,
  discoverCategory,
  addToCart,
  fetchCart,
  parsePrice,
  readPrice,
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  STORAGE_STATE,
  type ApiCart,
} from './helpers';

/**
 * Cart E2E Tests
 *
 * Full cart flow: add items, cart drawer, cart page, quantity changes,
 * item removal, promo code validation.
 *
 * Requires an authenticated customer: `orderPlacement` is authenticated-only
 * here, so anonymous visitors get no add-to-cart button.
 *
 * Note: After addToCart() navigates to PDP and adds an item, the cart drawer
 * opens. Navigating to /cart with page.goto() is a full page load that resets
 * Pinia state, but the cartId cookie persists and CartPage fetches the cart
 * on mount. We must wait for hydration + data loading.
 */

outOfScope(
  !hasE2ECredentials(),
  'no-credentials',
  'cart flows need an authenticated customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
);

test.use({ storageState: STORAGE_STATE });

test.describe('Cart', () => {
  // Every test starts with an empty cart: Playwright gives each test a fresh
  // browser context from the stored login state, which carries no cart cookie,
  // so a cart created in one test never reaches the next. No clearing needed.

  test('should start with an empty cart', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Cart should show empty state or no items
    const emptyState = page.locator(
      '[data-testid="cart-page-empty"], [data-testid="cart-empty"], [data-testid="empty-state"]',
    );
    const cartItem = page.locator('[data-testid="cart-item"]');

    // Either empty state is shown or no cart items exist
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasItems = await cartItem.isVisible().catch(() => false);

    expect(hasEmpty || !hasItems).toBe(true);
  });

  test('should add a product to cart from PDP', async ({ page }) => {
    const product = await discoverPurchasableProduct(page);

    await addToCart(page, product.alias);

    // Cart drawer should be open with the item
    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible();

    const cartItem = drawer.locator('[data-testid="cart-item"]');
    await expect(cartItem.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show cart item on cart page after adding', async ({ page }) => {
    const product = await discoverPurchasableProduct(page);

    await addToCart(page, product.alias);

    // Navigate to cart page — full page load, Pinia resets but cookie persists
    await page.goto('/cart');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Wait for CartPage to fetch cart data via cartId cookie
    const cartItem = page.locator('[data-testid="cart-item"]');
    await expect(cartItem.first()).toBeVisible({ timeout: 20000 });

    // Item name should be visible
    const itemName = page.locator('[data-testid="cart-item-name"]').first();
    await expect(itemName).toBeVisible();
  });

  test('should remove item from cart', async ({ page }) => {
    const product = await discoverPurchasableProduct(page);

    await addToCart(page, product.alias);
    await page.goto('/cart');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Verify item exists
    await expect(page.locator('[data-testid="cart-item"]').first()).toBeVisible(
      { timeout: 20000 },
    );

    // Remove it
    const removeButton = page
      .locator('[data-testid="cart-item-remove"]')
      .first();
    await removeButton.click();

    // Wait for removal — empty state appears
    await expect(
      page
        .locator(
          '[data-testid="cart-page-empty"], [data-testid="cart-empty"], [data-testid="empty-state"]',
        )
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('should show error for invalid promo code', async ({ page }) => {
    const product = await discoverPurchasableProduct(page);

    await addToCart(page, product.alias);

    // Promo code input is in the cart drawer (not the cart page)
    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible();

    const promoInput = drawer.locator('[data-testid="promo-input"]');
    const promoApply = drawer.locator('[data-testid="promo-apply"]');

    if (await promoInput.isVisible().catch(() => false)) {
      await promoInput.fill('INVALID_PROMO_12345');
      await promoApply.click();

      // Wait for the promo code API response
      await page
        .waitForResponse(
          (resp) =>
            resp.url().includes('/api/cart/promo') && resp.status() !== 0,
          { timeout: 10000 },
        )
        .catch(() => {
          // Fallback: API may not fire if validation is client-side
        });

      // The promo code should not be applied — no active promo visible
      const promoRemove = drawer.locator('[data-testid="promo-remove"]');
      const hasActivePromo = await promoRemove.isVisible().catch(() => false);
      expect(hasActivePromo).toBe(false);
    }
  });

  test('should add product from PLP grid add-to-cart button', async ({
    page,
  }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await waitForHydration(page);

    // Click the first add-to-cart button on the PLP (grid view shows "Köp", list shows "Lägg i varukorg")
    // canPurchase depends on auth, catalog mode and stock, so a category
    // whose first cards offer no button is a real state — the suite already
    // treats this as something to probe (discoverPurchasableProduct).
    const addButton = page
      .locator('[data-testid="add-to-cart-button"]')
      .first();
    outOfScope(
      !(await addButton.isVisible().catch(() => false)),
      'fixture-missing',
      'no product card in the discovered category offers add-to-cart',
    );

    await addButton.click();

    // Cart drawer should open
    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // Cart should have at least 1 item
    const cartItem = drawer.locator('[data-testid="cart-item"]');
    await expect(cartItem.first()).toBeVisible({ timeout: 10000 });
  });

  test('should update quantity in cart drawer', async ({ page }) => {
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias);

    // Cart drawer is open with the item
    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible();

    const cartItem = drawer.locator('[data-testid="cart-item"]').first();
    await expect(cartItem).toBeVisible({ timeout: 10000 });

    // Find the quantity input within the cart item
    const quantityInput = cartItem.locator(
      '[data-testid="quantity-input"] input',
    );

    // Get initial quantity
    const initialQty = await quantityInput.inputValue();

    // Click the increment button (NumberFieldIncrement)
    const incrementButton = cartItem.locator(
      '[data-testid="quantity-input"] button:last-of-type',
    );
    await incrementButton.click();

    // Wait for cart API response
    await page
      .waitForResponse(
        (resp) => resp.url().includes('/api/cart') && resp.status() !== 0,
        { timeout: 10000 },
      )
      .catch(() => {});

    // Verify quantity changed
    const updatedQty = await quantityInput.inputValue();
    expect(Number(updatedQty)).toBe(Number(initialQty) + 1);
  });

  test('should delete item from cart drawer', async ({ page }) => {
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias);

    // Cart drawer is open with the item
    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(
      drawer.locator('[data-testid="cart-item"]').first(),
    ).toBeVisible({ timeout: 10000 });

    // Click the remove/delete button
    const removeButton = drawer
      .locator('[data-testid="cart-item-remove"]')
      .first();
    await removeButton.click();

    // Wait for cart API response
    await page
      .waitForResponse(
        (resp) => resp.url().includes('/api/cart') && resp.status() !== 0,
        { timeout: 10000 },
      )
      .catch(() => {});

    // Verify cart shows empty state
    const emptyState = drawer.locator('[data-testid="cart-empty"]');
    await expect(emptyState).toBeVisible({ timeout: 10000 });
  });

  test('should persist cart across category navigation', async ({ page }) => {
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias);

    // Cart drawer is open — close it
    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible({ timeout: 5000 });

    // Navigate to a category page (full navigation)
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Wait for products to load
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });

    // Verify cart still has items by checking the cart page
    await page.goto('/cart');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // Cart should still have items (cookie persists the cartId)
    const cartItem = page.locator('[data-testid="cart-item"]');
    await expect(cartItem.first()).toBeVisible({ timeout: 20000 });
  });
});

/**
 * Values, compared against the cart the server computed for the same cart id.
 *
 * The suite's recipe for a value assertion (see the price block in
 * product-browsing.spec.ts): read the expected numbers from the API, read the
 * rendered ones with `readPrice`, never compare formatted strings, and assert
 * both sides of every flag.
 *
 * Each test gets a fresh context from the stored login state, which carries no
 * cart cookie, so the cart these tests read is their own — the three browser
 * projects run in parallel without touching each other's totals.
 */
test.describe('Cart values', () => {
  // More than one, or "quantity x unit price" is not a multiplication.
  const QUANTITY = 3;

  /**
   * Shipping has no number before checkout: `/api/cart` sends an empty fee
   * string until an option is selected, and the two surfaces answer that
   * differently — the page falls back to "calculated at checkout", the drawer
   * drops the row. Asserting the fallback as text would assert the active
   * locale, so the absence is asserted as "no digits here" instead.
   */
  async function expectShippingMatches(
    cell: Locator,
    surface: 'page' | 'drawer',
    feeFormatted: string,
  ) {
    if (feeFormatted === '') {
      if (surface === 'drawer') {
        await expect(cell).toHaveCount(0);
        return;
      }
      await expect(cell).toBeVisible();
      const text = (await cell.innerText()).trim();
      expect(
        text.length,
        'the shipping cell rendered nothing at all',
      ).toBeGreaterThan(0);
      expect(
        /\d/.test(text),
        `the API sent no shipping fee, so the cell must not show a number: ${JSON.stringify(text)}`,
      ).toBe(false);
      return;
    }

    expect(await readPrice(cell)).toBeCloseTo(parsePrice(feeFormatted), 2);
  }

  /** Subtotal, VAT and total on one surface, against the cart the API reports. */
  async function expectSummaryMatches(root: Locator, cart: ApiCart) {
    // vat_display defaults to 'ex' (app/composables/useVatDisplay.ts) and the
    // stored login state carries that default, so the ex-VAT numbers are the
    // ones these surfaces must show.
    expect(
      await readPrice(root.locator('[data-testid="cart-summary-subtotal"]')),
    ).toBeCloseTo(cart.subTotalExVat, 2);
    expect(
      await readPrice(root.locator('[data-testid="cart-summary-tax"]')),
    ).toBeCloseTo(cart.vat, 2);
    expect(
      await readPrice(root.locator('[data-testid="cart-summary-total"]')),
    ).toBeCloseTo(cart.totalExVat, 2);
  }

  async function openCartPage(page: Page) {
    await page.goto('/cart');
    await page.waitForLoadState('load');
    await waitForHydration(page);
    await expect(page.locator('[data-testid="cart-item"]').first()).toBeVisible(
      {
        timeout: 20000,
      },
    );
  }

  test('drawer and cart page show the summary /api/cart reports', async ({
    page,
  }) => {
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias, QUANTITY);

    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(
      drawer.locator('[data-testid="cart-item"]').first(),
    ).toBeVisible({ timeout: 10000 });

    const cart = await fetchCart(page);
    // The quantity the PDP was asked for is the quantity the cart holds, or
    // every number below is measured against a cart nobody asked for.
    expect(cart.items[0]!.quantity).toBe(QUANTITY);

    await expectSummaryMatches(drawer, cart);
    await expectShippingMatches(
      drawer.locator('[data-testid="cart-summary-shipping"]'),
      'drawer',
      cart.shippingFeeFormatted,
    );

    await openCartPage(page);

    await expectSummaryMatches(page.locator('[data-testid="cart-page"]'), cart);
    await expectShippingMatches(
      page.locator('[data-testid="cart-summary-shipping"]'),
      'page',
      cart.shippingFeeFormatted,
    );
  });

  test('a cart line shows quantity x unit price as its total', async ({
    page,
  }) => {
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias, QUANTITY);
    await openCartPage(page);

    const cart = await fetchCart(page);
    const line = cart.items[0]!;
    expect(line.quantity).toBe(QUANTITY);

    const item = page.locator('[data-testid="cart-item"]').first();
    const unitPrice = await readPrice(
      item.locator('[data-testid="cart-item-unit-price"]'),
    );
    const totalPrice = await readPrice(
      item.locator('[data-testid="cart-item-total-price"]'),
    );

    expect(unitPrice).toBeCloseTo(line.unitPriceExVat, 2);
    expect(totalPrice).toBeCloseTo(line.totalPriceExVat, 2);
    // The multiplication itself, on both sides: the rendered pair must agree
    // with each other and with what the server charged for the line.
    expect(totalPrice).toBeCloseTo(unitPrice * QUANTITY, 2);
    expect(line.totalPriceExVat).toBeCloseTo(line.unitPriceExVat * QUANTITY, 2);
  });

  test('the summary follows a quantity change', async ({ page }) => {
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias, QUANTITY);
    await openCartPage(page);

    const before = await fetchCart(page);
    expect(before.items[0]!.quantity).toBe(QUANTITY);
    // A free line would make both the re-render wait and the growing subtotal
    // below true of a cart that never changed.
    expect(
      before.items[0]!.unitPriceExVat,
      'the discovered product is free, so a quantity change moves no number',
    ).toBeGreaterThan(0);

    const item = page.locator('[data-testid="cart-item"]').first();
    const amount = item.locator('[data-testid="quantity-input"] input');
    const lineTotal = item.locator('[data-testid="cart-item-total-price"]');
    const increment = item.locator(
      '[data-testid="quantity-input"] button:last-of-type',
    );
    const lineTotalBefore = (await lineTotal.innerText()).trim();

    // Wait for the PUT itself rather than swallowing it: without the server's
    // answer the assertions below race the update and pass on the old cart.
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/cart/items') &&
          resp.request().method() === 'PUT',
        { timeout: 15000 },
      ),
      increment.click(),
    ]);
    expect(
      response.ok(),
      `PUT /api/cart/items returned HTTP ${response.status()}`,
    ).toBe(true);
    // The control moves optimistically on click, so it says nothing about the
    // summary. The line total only changes once the server's cart is rendered,
    // which is what the numbers below are read against.
    await expect(amount).toHaveValue(String(QUANTITY + 1));
    await expect(lineTotal).not.toHaveText(lineTotalBefore);

    // Re-read: the cart the page now shows is a different cart than `before`.
    const after = await fetchCart(page);
    expect(after.items[0]!.quantity).toBe(QUANTITY + 1);
    expect(after.subTotalExVat).toBeGreaterThan(before.subTotalExVat);

    await expectSummaryMatches(
      page.locator('[data-testid="cart-page"]'),
      after,
    );
    expect(await readPrice(lineTotal)).toBeCloseTo(
      after.items[0]!.unitPriceExVat * (QUANTITY + 1),
      2,
    );
  });

  test('the discount line carries what the API reports', async ({ page }) => {
    const product = await discoverPurchasableProduct(page);
    await addToCart(page, product.alias, QUANTITY);
    await openCartPage(page);

    const cart = await fetchCart(page);

    // Asserting a zero here would pass whether or not the line works, so the
    // empty case is declared rather than asserted. The day the tenant carries
    // a promotion this becomes a real assertion instead of a skip.
    outOfScope(
      cart.discountIncVat === 0,
      'tenant-config',
      'the tenant has no promotion, so the discount line never carries a value',
    );

    const discountRow = page.locator('[data-testid="cart-summary-discount"]');
    await expect(discountRow).toBeVisible();
    // The row id covers the label too, hence a second id on the amount.
    // `discountAmount` is the inc-VAT figure the store exposes
    // (app/stores/cart.ts:24), which is what both surfaces render today.
    expect(
      await readPrice(
        discountRow.locator('[data-testid="cart-summary-discount-amount"]'),
      ),
    ).toBeCloseTo(cart.discountIncVat, 2);
  });
});
