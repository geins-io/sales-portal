import { expect, test, type Page } from '@playwright/test';
import { e2eCredentials, hasE2ECredentials } from './target';

export { e2eCredentials, hasE2ECredentials };

/**
 * E2E Test Helpers
 *
 * Shared utilities for dynamic data discovery, common actions, and assertions.
 * Tests use real Geins API data — no hardcoded slugs.
 *
 * NOTE: Type-prefixed routing (ADR-015)
 * The server middleware redirects `/` to `/{market}/{locale}/` (e.g. `/se/sv/`).
 * When navigating to `/`, Playwright will follow the redirect automatically.
 * Category pages require a `/c/` prefix (e.g. `/c/material`), products require
 * `/p/` (e.g. `/p/product-name`). The menu API returns canonical URLs with
 * market/locale prefixes (e.g. `/se/sv/material`) which must be stripped and
 * have the correct type prefix added before navigation.
 */

// ---------- Declared scope ----------

/**
 * Every reason a test may legitimately not run, as a closed list. A skipped
 * test that carries none of these is "unknown" and fails the run
 * (tests/e2e/reporters/scope-reporter.ts). Adding a reason here is a reviewed
 * change; a bare `test.skip()` / `test.fixme()` in a spec is a lint error.
 *
 * - `no-credentials`: E2E_USERNAME / E2E_PASSWORD not set.
 * - `mobile-project`: the feature is desktop-only (hidden below `lg`).
 * - `dev-server`: the assertion needs the production build (CSP header).
 * - `fixture-missing`: the test account lacks the data (quotes, saved lists).
 *   Goes away with the seeded team-owned tenant (SAL-361).
 * - `tenant-config`: the tenant's configuration does not exercise this path
 *   (single locale, no CMS apply page). The dangerous one — "passes on
 *   tenant-a" says nothing about other tenants. M3 turns these into
 *   assertions derived from `/api/config`; until then the reporter lists
 *   every instance so they stay visible.
 */
export type ScopeReason =
  | 'no-credentials'
  | 'mobile-project'
  | 'dev-server'
  | 'fixture-missing'
  | 'tenant-config';

/**
 * Skip the current test — or, called at file/describe level, every test in
 * the block — as declared out of scope. The only sanctioned way to skip in
 * this suite. Playwright records it as a `skip` annotation whose description
 * starts with the reason; the reporter keys on that prefix, so it works both
 * inside a test and at describe level (where `test.info()` is unavailable).
 */
export function outOfScope(
  condition: boolean,
  reason: ScopeReason,
  detail: string,
): void {
  test.skip(condition, `${reason}: ${detail}`);
}

/** Annotation type for a test that ran with part of its assertions off. */
export const SCOPE_NOTE_ANNOTATION = 'scope';

/**
 * Same declaration for a test that still runs but with part of its
 * assertions off (e.g. no CSP header on the dev server). Shows up in the
 * run summary; does not skip.
 */
export function noteOutOfScope(reason: ScopeReason, detail: string): void {
  test.info().annotations.push({
    type: SCOPE_NOTE_ANNOTATION,
    description: `${reason}: ${detail}`,
  });
}

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

interface RawProduct {
  skus?: { skuId: number }[];
  alias?: string;
  name?: string;
}

/**
 * Candidates with a usable alias and SKU, sorted by alias — the products API
 * applies no stable ordering, so an unsorted "first one" differs per call.
 */
async function fetchProductCandidates(
  page: Page,
): Promise<DiscoveredProduct[]> {
  const response = await page.request.get('/api/product-lists/products', {
    params: { take: '20' },
  });
  expect(response.ok()).toBe(true);

  const data = await response.json();
  const products: RawProduct[] = data.products ?? [];

  return products
    .filter(
      (p): p is RawProduct & { alias: string } => !!(p.skus?.length && p.alias),
    )
    .map((p) => ({
      alias: p.alias,
      skuId: p.skus![0]!.skuId,
      name: p.name ?? p.alias,
    }))
    .sort((a, b) => a.alias.localeCompare(b.alias));
}

/** A product with a valid SKU. Use `discoverPurchasableProduct` to buy. */
export async function discoverProduct(page: Page): Promise<DiscoveredProduct> {
  const candidates = await fetchProductCandidates(page);
  expect(
    candidates.length,
    'no product with a SKU and alias found',
  ).toBeGreaterThan(0);
  return candidates[0]!;
}

/** Memoised per worker — probing costs a page load + hydration wait each. */
let purchasableProductCache: DiscoveredProduct | undefined;

/**
 * A product whose PDP actually offers an add-to-cart button. A SKU is not
 * enough (out of stock hides it), and `stockStatus` is disabled here so the
 * list API exposes no stock — hence probing the PDP.
 */
export async function discoverPurchasableProduct(
  page: Page,
  maxAttempts = 3,
): Promise<DiscoveredProduct> {
  if (purchasableProductCache) return purchasableProductCache;

  const candidates = await fetchProductCandidates(page);
  expect(
    candidates.length,
    'no product with a SKU and alias found',
  ).toBeGreaterThan(0);

  const tried: string[] = [];

  for (const candidate of candidates.slice(0, maxAttempts)) {
    tried.push(candidate.alias);

    await page.goto(`/p/${candidate.alias}`);
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const visible = await page
      .locator('[data-testid="add-to-cart-button"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (visible) {
      purchasableProductCache = candidate;
      return candidate;
    }
  }

  throw new Error(
    `No purchasable product found after ${tried.length} attempts (tried: ${tried.join(', ')}). ` +
      `Every candidate was out of stock, or the session is not authenticated and ` +
      `this tenant gates orderPlacement behind access: 'authenticated'.`,
  );
}

/**
 * Strip the Geins market/locale prefix from a canonical URL.
 * Menu API returns URLs like `/se/sv/material` — we strip `/se/sv/` to get `/material`.
 * This is a simplified version of shared/utils/menu.ts `stripGeinsPrefix` for E2E use
 * (Playwright tests can't import Nuxt aliases).
 */
function stripMarketLocalePrefix(path: string): string {
  return path.replace(/^\/[a-z]{2}\/[a-z]{2}(?:-[a-z]{2})?\//i, '/');
}

/**
 * Discover a category by resolving a known route pattern.
 * Falls back to fetching the menu and picking the first category link.
 *
 * Returns alias with `/c/` type prefix (e.g. `c/material`) so tests can
 * navigate with `page.goto(`/${category.alias}`)`.
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
        // Strip market/locale prefix (e.g. /se/sv/material → /material)
        // then add /c/ type prefix for category routing (ADR-015)
        const stripped = stripMarketLocalePrefix(item.canonicalUrl);
        return {
          alias: `c${stripped}`,
          name: item.title || item.label || 'Category',
        };
      }
    }
  }

  throw new Error('Could not discover any category from menu');
}

// ---------- Authentication ----------

/** Session persisted by the preflight session layer. Opt in via `test.use`. */
export const STORAGE_STATE = 'playwright/.auth/user.json';

/** Sign in. Asserts the response so a bad credential fails here, not later. */
export async function login(
  page: Page,
  credentials = e2eCredentials,
): Promise<void> {
  await page.goto('/se/sv/login');
  await page.waitForLoadState('load');
  await waitForHydration(page);

  const emailInput = page.locator('[data-testid="login-email"]');
  await expect(emailInput).toBeVisible({ timeout: 20000 });

  await emailInput.fill(credentials.username);
  await page
    .locator('[data-testid="login-password"]')
    .fill(credentials.password);

  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      { timeout: 20000 },
    ),
    page.locator('[data-testid="login-submit"]').click(),
  ]);

  expect(
    response.ok(),
    `login failed for the configured E2E account (HTTP ${response.status()}) — ` +
      `check E2E_USERNAME / E2E_PASSWORD in .env`,
  ).toBe(true);

  // The login page redirects once the session cookie is set.
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 20000,
  });
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
  await addButton.scrollIntoViewIfNeeded();

  const drawer = page.locator('[data-testid="cart-drawer"]');

  // `tap()` throws unless the context has `hasTouch`, hence the probe.
  const hasTouch = await page
    .evaluate(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0)
    .catch(() => false);

  // Retry — hydration patching can leave the first interaction unhandled.
  // Record why each failed; swallowing them yields an opaque 60s timeout.
  const failures: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Assert the response, not just the drawer — a server error otherwise
      // looks identical to a tap that never registered.
      const [response] = await Promise.all([
        page
          .waitForResponse(
            (r) =>
              r.url().includes('/api/cart/items') &&
              r.request().method() === 'POST',
            { timeout: 10000 },
          )
          .catch(() => null),
        // Capped so one hung action can't starve the retries.
        hasTouch
          ? addButton.tap({ timeout: 12000 })
          : addButton.click({ timeout: 12000 }),
      ]);

      if (response && !response.ok()) {
        failures.push(
          `attempt ${attempt + 1}: POST /api/cart/items returned HTTP ${response.status()}`,
        );
        continue;
      }
      if (!response) {
        failures.push(
          `attempt ${attempt + 1}: no POST to /api/cart/items within 10s ` +
            `(${hasTouch ? 'tap' : 'click'} did not reach the handler)`,
        );
        continue;
      }

      await drawer.waitFor({ state: 'visible', timeout: 5000 });
      return;
    } catch (error) {
      // Keep the actionability log — it names what blocked the action.
      failures.push(
        `attempt ${attempt + 1}: ` +
          (error as Error).message
            .split('\n')
            .filter((l) => l.trim())
            .slice(0, 24)
            .join('\n      '),
      );
    }
  }

  throw new Error(
    `addToCart failed for "${productAlias}" after 3 attempts ` +
      `(touch=${hasTouch}):\n  ${failures.join('\n  ')}`,
  );
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
  await page.waitForTimeout(300);
}

// ---------- Viewport ----------

export async function setMobileViewport(page: Page) {
  await page.setViewportSize({ width: 375, height: 667 });
}

export async function setDesktopViewport(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
}
