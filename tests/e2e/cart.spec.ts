import { test, expect, type Locator, type Page } from './fixtures';
import {
  discoverPurchasableProduct,
  discoverProduct,
  discoverCategory,
  addToCart,
  fetchCart,
  readPrice,
  waitForHydration,
  hasE2ECredentials,
  isConfigurable,
  outOfScope,
  signedInState,
  type ApiCart,
} from './helpers';
import { localeText } from './locale-text';

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

test.use({ storageState: signedInState });

/**
 * The boxes of the given parts of `root`, measured in one frame: two
 * boundingBox() calls land in different frames while the drawer slides in.
 */
function boxesInOneFrame(root: Locator, testIds: string[]) {
  return root.evaluate(
    (el, ids) =>
      ids.map((id) => {
        const { x, y, height } = el
          .querySelector(`[data-testid="${id}"]`)!
          .getBoundingClientRect();
        return { x, y, height };
      }),
    testIds,
  );
}

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

    // The context carries no cart cookie, so this cart is empty by
    // construction — the empty state is the one state this test reaches.
    // `hasEmpty || !hasItems` restated its first operand and passed either way.
    await expect(emptyState).toBeVisible();
    await expect(cartItem).toHaveCount(0);
    await expect(page.locator('[data-testid="cart-vat-note"]')).toHaveCount(0);
  });

  test('closing the cart page opened directly goes to the start page, not out of the portal', async ({
    page,
  }) => {
    await page.goto('/cart');
    await page.waitForLoadState('load');
    await waitForHydration(page);
    const origin = new URL(page.url()).origin;

    await page.locator('[data-testid="cart-page-close"]').click();

    await expect(page).toHaveURL(
      (url) =>
        url.origin === origin &&
        /^\/(?:[a-z]{2}\/[a-z]{2}\/?)?$/.test(url.pathname),
    );
    await expect(page.locator('[data-testid="cart-page"]')).toHaveCount(0);
  });

  test('closing the cart page reached from a product page goes back to that product', async ({
    page,
  }) => {
    const product = await discoverProduct(page);
    await page.goto(`/p/${product.alias}`);
    await page.waitForLoadState('load');
    await waitForHydration(page);
    const productUrl = page.url();
    const prefix =
      new URL(productUrl).pathname.match(/^\/[a-z]{2}\/[a-z]{2}/)?.[0] ?? '';

    // Nothing in the portal links to /cart, so the app's own router takes the
    // buyer there, as an in-app link would.
    await page.evaluate((to) => {
      const app = (
        document.querySelector('#__nuxt') as unknown as {
          __vue_app__: {
            config: {
              globalProperties: { $router: { push: (to: string) => unknown } };
            };
          };
        }
      ).__vue_app__;
      return app.config.globalProperties.$router.push(to);
    }, `${prefix}/cart`);
    await expect(page.locator('[data-testid="cart-page"]')).toBeVisible();

    await page.locator('[data-testid="cart-page-close"]').click();

    await expect(page).toHaveURL(productUrl);
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

    // Declared on the measured state rather than on `true`: `/api/cart/promo`,
    // the store action and `PromoCodeInput` all still exist — only the markup
    // that mounts the component is gone, parked on a design decision. Written
    // this way the test wakes up on its own the day the field comes back.
    outOfScope(
      !(await promoInput.isVisible().catch(() => false)),
      'feature-hidden',
      'no surface renders the promo field, so no code can be submitted',
    );

    await promoInput.fill('INVALID_PROMO_12345');
    await promoApply.click();

    // The rejection the test is named for. Asserting only "no active promo" is
    // true of a drawer that was never sent a code — which is what this used to
    // assert, inside a branch it never entered. The error element retries, so
    // it also serves as the wait for the response.
    await expect(drawer.locator('[data-testid="cart-error"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(drawer.locator('[data-testid="promo-remove"]')).toHaveCount(0);
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
   * The cart's shipping fee and fixed discount excluding VAT, the figures the
   * cart shows in the default VAT choice. `fetchCart` carries the inc-VAT ones
   * that checkout reads.
   */
  async function exVatFigures(page: Page) {
    const cartId = (await page.context().cookies()).find(
      (cookie) => cookie.name === 'cart_id',
    )?.value;
    const response = await page.request.get('/api/cart', {
      params: { cartId: cartId! },
    });
    expect(response.ok(), '/api/cart did not answer 200').toBe(true);
    const summary = (await response.json())?.summary;
    return {
      shippingFee: summary?.shipping?.feeExVat as number,
      discount: summary?.fixedAmountDiscountExVat as number,
    };
  }

  /**
   * Shipping has no number before checkout: `/api/cart` sends an empty fee
   * string until an option is selected, and both surfaces then say it may
   * apply.
   */
  async function expectShippingMatches(
    page: Page,
    cell: Locator,
    feeFormatted: string,
  ) {
    if (feeFormatted === '') {
      await expect(cell).toHaveText(
        await localeText(page, 'common.shipping_may_apply'),
      );
      return;
    }

    expect(await readPrice(cell)).toBeCloseTo(
      (await exVatFigures(page)).shippingFee,
      2,
    );
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
    // Under the ex-VAT total: what is charged, the inc-VAT total.
    const toPay = root.locator('[data-testid="cart-summary-to-pay"]');
    await expect(toPay).toContainText(
      await localeText(root.page(), 'common.to_pay_inc_vat'),
    );
    expect(await readPrice(toPay.locator('dd'))).toBeCloseTo(
      cart.totalIncVat,
      2,
    );
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
    const product = await discoverPurchasableProduct(page, QUANTITY);
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
      page,
      drawer.locator('[data-testid="cart-summary-shipping"]'),
      cart.shippingFeeFormatted,
    );

    await openCartPage(page);

    await expectSummaryMatches(page.locator('[data-testid="cart-page"]'), cart);
    await expectShippingMatches(
      page,
      page.locator('[data-testid="cart-summary-shipping"]'),
      cart.shippingFeeFormatted,
    );
  });

  test('a cart line shows quantity x unit price as its total', async ({
    page,
  }) => {
    const product = await discoverPurchasableProduct(page, QUANTITY);
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
    const product = await discoverPurchasableProduct(page, QUANTITY);
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
    const product = await discoverPurchasableProduct(page, QUANTITY);
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
    // The row id covers the label too, hence a second id on the amount. The
    // cart shows it in the buyer's VAT choice, ex VAT by default.
    expect(
      await readPrice(
        discountRow.locator('[data-testid="cart-summary-discount-amount"]'),
      ),
    ).toBeCloseTo((await exVatFigures(page)).discount, 2);
  });
});

/**
 * The cart as the narrow panel: one column, the lines scroll, the summary and
 * "Gå till kassan" stay at the bottom of the panel and of the cart page.
 */
test.describe('Cart layout', () => {
  test.describe.configure({ timeout: 120_000 });

  /** How many lines make a list longer than the panel on every viewport. */
  const LINES = 8;

  /** This host's cart id: the stored session may hold other tenants' cookies. */
  async function cartIdOf(page: Page): Promise<string> {
    const id = (await page.context().cookies(page.url())).find(
      (c) => c.name === 'cart_id',
    )?.value;
    expect(id, 'the page holds no cart').toBeTruthy();
    return id!;
  }

  /**
   * A cart of LINES ordinary lines: the first through the PDP, so the page
   * owns the cart, the rest straight to the cart route. A product that is out
   * of stock answers 200 and adds no line, so lines are counted, not assumed.
   */
  async function fillCart(page: Page): Promise<number> {
    const first = await discoverPurchasableProduct(page);
    await addToCart(page, first.alias);
    const cartId = await cartIdOf(page);

    const response = await page.request.get('/api/product-lists/products', {
      params: { take: '60', filter: JSON.stringify({ sort: 'ALPHABETICAL' }) },
    });
    expect(response.ok()).toBe(true);
    const rows: { alias?: string; skus?: { skuId: number }[] }[] =
      (await response.json()).products ?? [];

    let count = (await fetchCart(page)).items.length;
    for (const row of rows) {
      if (count >= LINES) break;
      const skuId = row.skus?.[0]?.skuId;
      if (!row.alias || !skuId || row.alias === first.alias) continue;
      if (await isConfigurable(page, row.alias)) continue;
      const added = await page.request.post('/api/cart/items', {
        data: { cartId, skuId, quantity: 1 },
      });
      if (added.ok()) count = (await fetchCart(page)).items.length;
    }
    expect(
      count,
      `the catalogue gave only ${count} lines that could be added`,
    ).toBeGreaterThanOrEqual(LINES);
    return count;
  }

  async function openDrawer(page: Page): Promise<Locator> {
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);
    await page.locator('[data-slot="cart-button"]').click();
    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(
      drawer.locator('[data-testid="cart-item"]').first(),
    ).toBeVisible({ timeout: 20000 });
    return drawer;
  }

  /**
   * Scrolled to the last line, the first one has left the view and the
   * summary and the checkout button have not.
   */
  async function expectBottomStays(
    lines: Locator,
    summary: Locator,
    checkout: Locator,
  ) {
    await expect(summary).toBeInViewport({ ratio: 1 });
    await expect(checkout).toBeInViewport({ ratio: 1 });
    await expect(lines.last()).not.toBeInViewport();

    await lines.last().scrollIntoViewIfNeeded();
    await expect(lines.last()).toBeInViewport();
    await expect(lines.first()).not.toBeInViewport();
    await expect(summary).toBeInViewport({ ratio: 1 });
    await expect(checkout).toBeInViewport({ ratio: 1 });
  }

  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ] as const) {
    test.describe(name, () => {
      test.use({ viewport });

      test('the panel scrolls its lines and keeps the summary and checkout at the bottom', async ({
        page,
      }) => {
        const count = await fillCart(page);
        const drawer = await openDrawer(page);

        const lines = drawer.locator('[data-testid="cart-item"]');
        await expect(lines).toHaveCount(count);
        await expect(
          drawer.locator('[data-testid="cart-vat-note"]'),
        ).toHaveText(await localeText(page, 'cart.prices_ex_vat'));
        await expectBottomStays(
          lines,
          drawer.locator('[data-testid="cart-summary"]'),
          drawer.locator('[data-testid="cart-drawer-checkout-button"]'),
        );
      });

      test('the cart page keeps the summary and checkout at the bottom of the window', async ({
        page,
      }) => {
        const count = await fillCart(page);
        await page.goto('/cart');
        await page.waitForLoadState('load');
        await waitForHydration(page);

        const cartPage = page.locator('[data-testid="cart-page"]');
        const lines = cartPage.locator('[data-testid="cart-item"]');
        await expect(lines).toHaveCount(count, { timeout: 20000 });
        await expect(
          cartPage.locator('[data-testid="cart-vat-note"]'),
        ).toHaveText(await localeText(page, 'cart.prices_ex_vat'));
        await expectBottomStays(
          lines,
          cartPage.locator('[data-testid="cart-order-summary"]'),
          cartPage.locator('[data-testid="cart-checkout-button"]'),
        );
      });
    });
  }

  test('a line shows its total and, under it, the unit price "/st", with no VAT word', async ({
    page,
  }) => {
    const product = await discoverPurchasableProduct(page, 3);
    await addToCart(page, product.alias, 3);
    const drawer = page.locator('[data-testid="cart-drawer"]');
    const item = drawer.locator('[data-testid="cart-item"]').first();
    await expect(item).toBeVisible({ timeout: 10000 });

    const line = (await fetchCart(page)).items[0]!;
    const unit = item.locator('[data-testid="cart-item-unit-price"]');
    const total = item.locator('[data-testid="cart-item-total-price"]');
    expect(await readPrice(total)).toBeCloseTo(line.totalPriceExVat, 2);
    expect(await readPrice(unit)).toBeCloseTo(line.unitPriceExVat, 2);
    const perUnit = (await localeText(page, 'cart.per_unit')).replace(
      '{price}',
      '',
    );
    expect(await unit.innerText()).toContain(perUnit);

    const [totalBox, unitBox] = await boxesInOneFrame(item, [
      'cart-item-total-price',
      'cart-item-unit-price',
    ]);
    expect(unitBox!.y).toBeGreaterThanOrEqual(
      totalBox!.y + totalBox!.height - 1,
    );

    const priceText = await item
      .locator('[data-testid="cart-item-price"]')
      .innerText();
    for (const key of ['common.vat_excl', 'common.vat_incl']) {
      expect(priceText).not.toContain(await localeText(page, key));
    }
  });

  test('a sale-priced line strikes its regular total through before the sale total', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHydration(page);
    type Row = {
      alias?: string;
      unitPrice?: {
        isDiscounted?: boolean;
        sellingPriceExVat?: number;
        regularPriceExVat?: number;
      };
    };
    // The whole catalogue, a page at a time: a sale can sit on any product.
    const rows: Row[] = [];
    for (let skip = 0; ; skip += 100) {
      const response = await page.request.get('/api/product-lists/products', {
        params: {
          take: '100',
          skip: String(skip),
          filter: JSON.stringify({ sort: 'ALPHABETICAL' }),
        },
      });
      expect(response.ok()).toBe(true);
      const batch: Row[] = (await response.json()).products ?? [];
      rows.push(...batch);
      if (batch.length < 100) break;
    }
    // The same check the line makes: the flag, confirmed by half an öre.
    const onSale = rows.filter(
      (r) =>
        !!r.alias &&
        r.unitPrice?.isDiscounted === true &&
        (r.unitPrice.regularPriceExVat ?? 0) -
          (r.unitPrice.sellingPriceExVat ?? 0) >=
          0.005,
    );
    let product: (typeof onSale)[number] | undefined;
    for (const row of onSale) {
      if (!(await isConfigurable(page, row.alias!))) {
        product = row;
        break;
      }
    }
    outOfScope(
      !product,
      'tenant-config',
      'no product in the catalogue is on sale, so no line can show a sale price',
    );

    await addToCart(page, product!.alias!);
    const item = page
      .locator('[data-testid="cart-drawer"] [data-testid="cart-item"]')
      .first();
    await expect(item).toBeVisible({ timeout: 10000 });

    const regular = item.locator('[data-testid="cart-item-regular-price"]');
    const total = item.locator('[data-testid="cart-item-total-price"]');
    expect(await readPrice(regular)).toBeCloseTo(
      product!.unitPrice!.regularPriceExVat!,
      2,
    );
    expect(await readPrice(total)).toBeCloseTo(
      product!.unitPrice!.sellingPriceExVat!,
      2,
    );
    expect(
      await regular.evaluate((el) => getComputedStyle(el).textDecorationLine),
    ).toContain('line-through');
    await expect(total).toHaveClass(/text-destructive/);
    const [regularBox, totalBox] = await boxesInOneFrame(item, [
      'cart-item-regular-price',
      'cart-item-total-price',
    ]);
    expect(regularBox!.x).toBeLessThan(totalBox!.x);
  });
});
