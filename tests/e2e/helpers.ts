import { expect, type Page } from '@playwright/test';

/**
 * E2E Test Helpers
 *
 * Shared utilities for dynamic data discovery, common actions, and assertions.
 * Tests use real Geins API data — no hardcoded slugs.
 */

// ---------- Data Discovery ----------

export interface DiscoveredProduct {
  alias: string;
  skuId: number;
  name: string;
}

export interface DiscoveredCategory {
  alias: string;
  name: string;
}

/**
 * Discover a product by fetching the product list API and picking the first
 * in-stock product with a valid SKU.
 */
export async function discoverProduct(page: Page): Promise<DiscoveredProduct> {
  const response = await page.request.get('/api/product-lists/products', {
    params: { take: '20' },
  });
  expect(response.ok()).toBe(true);

  const data = await response.json();
  const products = data.products ?? [];

  // Find first product with a SKU
  const product = products.find(
    (p: { skus?: { skuId: number }[]; alias: string; name: string }) =>
      p.skus?.length && p.alias,
  );

  expect(product).toBeTruthy();

  return {
    alias: product.alias,
    skuId: product.skus[0].skuId,
    name: product.name,
  };
}

/**
 * Discover a category by resolving a known route pattern.
 * Falls back to fetching the menu and picking the first category link.
 */
export async function discoverCategory(
  page: Page,
): Promise<DiscoveredCategory> {
  // Fetch the main menu — items have a `type` field (category, brand, page, etc.)
  const menuResponse = await page.request.get('/api/cms/menu', {
    params: { menuLocationId: 'main' },
  });

  if (menuResponse.ok()) {
    const menu = await menuResponse.json();
    const items = menu?.menuItems ?? [];

    // Find first category-type menu item
    for (const item of items) {
      if (item.type === 'category' && item.canonicalUrl) {
        return {
          alias: item.canonicalUrl.replace(/^\//, ''),
          name: item.title || item.label || 'Category',
        };
      }
    }
  }

  throw new Error('Could not discover any category from menu');
}

// ---------- Actions ----------

/**
 * Navigate to a product's PDP and add it to cart by clicking the add-to-cart button.
 *
 * Because hydration mismatch patching can leave event handlers temporarily
 * unattached, we retry the click up to 3 times if the cart drawer doesn't open.
 */
export async function addToCart(page: Page, productAlias: string) {
  await page.goto(`/p/${productAlias}`);
  await page.waitForLoadState('load');
  await waitForHydration(page);

  const addButton = page.locator('[data-testid="add-to-cart-button"]').first();
  await expect(addButton).toBeVisible({ timeout: 20000 });
  await expect(addButton).toBeEnabled({ timeout: 10000 });

  const drawer = page.locator('[data-testid="cart-drawer"]');

  // Retry click up to 3 times — hydration mismatch patching can cause
  // the first click to miss the Vue handler
  for (let attempt = 0; attempt < 3; attempt++) {
    await addButton.click();
    const opened =
      (await drawer.isVisible().catch(() => false)) ||
      (await drawer
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false));
    if (opened) return;
  }

  // Final assertion with full timeout
  await expect(drawer).toBeVisible({ timeout: 10000 });
}

/**
 * Remove all items from the cart via the cart page.
 */
export async function clearCart(page: Page) {
  await page.goto('/cart');
  await page.waitForLoadState('domcontentloaded');

  // Remove items one by one
  let removeButton = page.locator('[data-testid="cart-item-remove"]').first();
  while (await removeButton.isVisible().catch(() => false)) {
    await removeButton.click();
    await page.waitForTimeout(500);
    removeButton = page.locator('[data-testid="cart-item-remove"]').first();
  }
}

/**
 * Fill the login form fields without submitting.
 */
export async function fillLoginForm(
  page: Page,
  email: string,
  password: string,
) {
  const emailInput = page.locator('[data-testid="login-email"]');
  const passwordInput = page.locator('[data-testid="login-password"]');

  await emailInput.fill(email);
  await passwordInput.fill(password);
}

/**
 * Fill the register form fields without submitting.
 */
export async function fillRegisterForm(
  page: Page,
  fields: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    company?: string;
    phone?: string;
  },
) {
  await page
    .locator('[data-testid="register-firstName"]')
    .fill(fields.firstName);
  await page.locator('[data-testid="register-lastName"]').fill(fields.lastName);
  await page.locator('[data-testid="register-email"]').fill(fields.email);
  await page.locator('[data-testid="register-password"]').fill(fields.password);
  if (fields.company) {
    await page.locator('[data-testid="register-company"]').fill(fields.company);
  }
  if (fields.phone) {
    await page.locator('[data-testid="register-phone"]').fill(fields.phone);
  }
}

// ---------- Assertions ----------

/**
 * Assert a data-testid element is visible on the page.
 */
export async function expectTestId(page: Page, testId: string) {
  await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
}

/**
 * Collect console errors during a page action, filtering out known noise.
 */
export async function expectNoConsoleErrors(
  page: Page,
  action: () => Promise<void>,
) {
  const errors: string[] = [];

  const handler = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  };

  page.on('console', handler);
  await action();
  page.removeListener('console', handler);

  const critical = errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('Failed to load resource') &&
      !e.includes('Cross-Origin-Opener-Policy') &&
      !e.includes('Content Security Policy'),
  );

  expect(critical).toHaveLength(0);
}

// ---------- Hydration ----------

/**
 * Wait for Nuxt/Vue to hydrate the page.
 * SSR renders static HTML immediately, but event handlers and reactivity
 * are only attached after Vue hydrates on the client. We detect hydration
 * by checking for the `__vue_app__` property on the Nuxt root element,
 * then wait for a tick to allow hydration mismatch patching to complete.
 */
export async function waitForHydration(page: Page, timeout = 15000) {
  await page.waitForFunction(
    () => {
      const nuxtRoot = document.getElementById('__nuxt');
      return !!(
        nuxtRoot && (nuxtRoot as unknown as Record<string, unknown>).__vue_app__
      );
    },
    { timeout },
  );

  // Allow Vue to finish hydration mismatch patching and re-attach event handlers
  await page.waitForTimeout(1000);
}

// ---------- Viewport ----------

export async function setMobileViewport(page: Page) {
  await page.setViewportSize({ width: 375, height: 667 });
}

export async function setDesktopViewport(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
}
