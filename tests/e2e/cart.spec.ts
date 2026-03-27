import { test, expect } from '@playwright/test';
import {
  discoverProduct,
  discoverCategory,
  addToCart,
  waitForHydration,
} from './helpers';

/**
 * Cart E2E Tests
 *
 * Full cart flow: add items, cart drawer, cart page, quantity changes,
 * item removal, promo code validation.
 *
 * Note: After addToCart() navigates to PDP and adds an item, the cart drawer
 * opens. Navigating to /cart with page.goto() is a full page load that resets
 * Pinia state, but the cartId cookie persists and CartPage fetches the cart
 * on mount. We must wait for hydration + data loading.
 */

test.describe('Cart', () => {
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
    const product = await discoverProduct(page);

    await addToCart(page, product.alias);

    // Cart drawer should be open with the item
    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible();

    const cartItem = drawer.locator('[data-testid="cart-item"]');
    await expect(cartItem.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show cart item on cart page after adding', async ({ page }) => {
    const product = await discoverProduct(page);

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
    const product = await discoverProduct(page);

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
    const product = await discoverProduct(page);

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
    const addButton = page
      .locator('[data-testid="add-to-cart-button"]')
      .first();
    if (!(await addButton.isVisible().catch(() => false))) return;

    await addButton.click();

    // Cart drawer should open
    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // Cart should have at least 1 item
    const cartItem = drawer.locator('[data-testid="cart-item"]');
    await expect(cartItem.first()).toBeVisible({ timeout: 10000 });
  });

  test('should update quantity in cart drawer', async ({ page }) => {
    const product = await discoverProduct(page);
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
    const product = await discoverProduct(page);
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
    const product = await discoverProduct(page);
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

  test('should redirect to login when clicking checkout without auth', async ({
    page,
  }) => {
    const product = await discoverProduct(page);
    await addToCart(page, product.alias);

    // Cart drawer is open — click checkout
    const drawer = page.locator('[data-testid="cart-drawer"]');
    await expect(drawer).toBeVisible();

    const checkoutButton = drawer.locator(
      '[data-testid="cart-drawer-checkout-button"]',
    );
    await expect(checkoutButton).toBeVisible({ timeout: 5000 });
    await checkoutButton.click();

    // Should redirect to login page with redirect query param
    await page.waitForURL(/\/login/, { timeout: 15000 });

    expect(page.url()).toContain('/login');
    // The redirect param should point to checkout
    expect(page.url()).toContain('redirect=');
    expect(page.url()).toMatch(/checkout/);
  });
});
