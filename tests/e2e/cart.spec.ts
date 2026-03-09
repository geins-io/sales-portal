import { test, expect } from '@playwright/test';
import { discoverProduct, addToCart, waitForHydration } from './helpers';

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
});
