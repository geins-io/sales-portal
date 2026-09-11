import { expect, test, type Locator, type Page } from '@playwright/test';
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
 * - `fixture-missing`: the test account lacks the data (quotes, saved lists) —
 *   data the platform cannot produce yet, not a tenant nobody seeded.
 * - `tenant-config`: the tenant's configuration does not exercise this path
 *   (single locale, no CMS apply page). The dangerous one — "passes on the
 *   configured tenant" says nothing about other tenants. Deriving these from
 *   `/api/config` as assertions is a later step; until then the reporter lists
 *   every instance so they stay visible.
 * - `remote-target`: `E2E_REMOTE=1` — the target is a deployed environment on
 *   purpose, so preflight L0's locality check does not apply.
 */
export type ScopeReason =
  | 'no-credentials'
  | 'mobile-project'
  | 'dev-server'
  | 'fixture-missing'
  | 'tenant-config'
  | 'remote-target';

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
  /** Rendered on every product card, so it links a card to this API row. */
  articleNumber: string | null;
}

export interface DiscoveredCategory {
  alias: string;
  name: string;
}

interface RawProduct {
  skus?: { skuId: number }[];
  alias?: string;
  name?: string;
  articleNumber?: string | null;
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
      articleNumber: p.articleNumber ?? null,
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

// ---------- Prices ----------

/** The unit price an API response carries, as numbers rather than copy. */
export interface ApiPrice {
  exVat: number;
  incVat: number;
  vat: number;
}

/**
 * The unit price `/api/products/<alias>` returns, as numbers.
 *
 * Uses the caller's browser context, so the signed-in and the anonymous run
 * each get what that caller is actually served. Every field is asserted to be
 * a finite number before it is returned: a helper that hands back `undefined`
 * turns the assertions built on it into a comparison of two undefineds, which
 * passes.
 */
export async function fetchProductPrice(
  page: Page,
  alias: string,
): Promise<ApiPrice> {
  const response = await page.request.get(`/api/products/${alias}`);
  expect(response.ok(), `/api/products/${alias} did not answer 200`).toBe(true);

  // `/api/products/<alias>` returns the product object itself, not a wrapper.
  const unitPrice = (await response.json())?.unitPrice;

  const price: ApiPrice = {
    exVat: unitPrice?.sellingPriceExVat,
    incVat: unitPrice?.sellingPriceIncVat,
    vat: unitPrice?.vat,
  };

  for (const [field, value] of Object.entries(price)) {
    expect(
      Number.isFinite(value),
      `unitPrice.${field} for "${alias}" is not a number: ${JSON.stringify(value)}`,
    ).toBe(true);
  }

  return price;
}

/**
 * The `market` / `locale` pair a locale-prefixed URL carries, in the shape the
 * product APIs take. `/se/sv/products` → `{ market: 'se', locale: 'sv' }`.
 *
 * Asserts the prefix rather than falling back to sending nothing. On an
 * unprefixed page the grid still sends both — `useLocaleMarket` reads the
 * market from a cookie, the tenant, then a hardcoded `'se'`, and the locale
 * from i18n state, none of it from the route — so a silent `{}` here would
 * read a different catalogue than the page while the completeness assertion
 * passed anyway. `page.goto` follows the server-side redirect to the prefixed
 * path, so this holds today; the assertion is what keeps it holding.
 */
function localeQueryFrom(url: string): Record<string, string> {
  const [market, locale] = new URL(url).pathname.split('/').filter(Boolean);
  const isCode = (v?: string) => !!v && /^[a-z]{2}$/.test(v);
  expect(
    isCode(market) && isCode(locale),
    `expected a locale-prefixed URL like /se/sv/…, got ${url}. Read the ` +
      `catalogue after navigating, or it is read for a different market and ` +
      `locale than the page used.`,
  ).toBe(true);
  return { market: market!, locale: locale! };
}

/** One row of the product-list endpoint, with the fields a grid test needs. */
export interface ProductListRow {
  alias: string;
  articleNumber: string;
  exVat: number;
}

/**
 * The whole catalogue from `/api/product-lists/products`, the endpoint the
 * `/products` grid renders from. Use these to identify a card: a card's link
 * carries the canonical URL rather than the alias the product endpoint takes,
 * while the article number is on both sides and identifies the pair.
 *
 * It reads everything rather than a page, because a partial read cannot be
 * matched against the grid. The endpoint applies no stable ordering — four
 * calls seconds apart returned four different first products — and the page
 * sends locale parameters this helper does not, so any two partial reads are
 * two different draws from the same catalogue. Measured overlap between one
 * such pair, four samples: 9, 4, 0 and 18 rows of 24. At zero the caller finds
 * no matching card and fails for a reason that has nothing to do with prices.
 *
 * `take` is capped at 100 by `ProductListSchema` (`server/schemas/api-input.ts`),
 * so a catalogue above that cannot be read in one call and this function
 * throws rather than quietly going back to comparing two draws.
 *
 * It requires the page to be on a locale-prefixed URL, and says so by
 * asserting it. The market and locale are read from that URL and sent along,
 * because the grid sends them too (`useLocaleMarket`'s `localeQuery`): reading
 * the same catalogue the page reads is what makes "the whole set" mean the
 * same thing on both sides, and it stays true if those parameters ever start
 * filtering rather than only ordering.
 */
export async function fetchProductListRows(
  page: Page,
  take = 100,
): Promise<ProductListRow[]> {
  const response = await page.request.get('/api/product-lists/products', {
    params: { take: String(take), ...localeQueryFrom(page.url()) },
  });
  expect(response.ok(), '/api/product-lists/products did not answer 200').toBe(
    true,
  );

  const body = await response.json();
  const products = body?.products ?? [];
  expect(
    products.length,
    `read ${products.length} of ${body?.count} products. The catalogue has grown past ` +
      `the endpoint's take cap of 100, so a single call no longer returns all of it — ` +
      `matching a grid card against a partial read is a coin toss, not an identity.`,
  ).toBe(body?.count);
  return products
    .filter(
      (p: {
        alias?: string;
        articleNumber?: string;
        unitPrice?: { sellingPriceExVat?: number };
      }) =>
        !!p.alias &&
        !!p.articleNumber &&
        Number.isFinite(p.unitPrice?.sellingPriceExVat),
    )
    .map(
      (p: {
        alias: string;
        articleNumber: string;
        unitPrice: { sellingPriceExVat: number };
      }) => ({
        alias: p.alias,
        articleNumber: p.articleNumber,
        exVat: p.unitPrice.sellingPriceExVat,
      }),
    );
}

/**
 * The number inside a rendered price, ignoring currency and separators.
 *
 * Never compare formatted price strings. The same amount reaches the DOM as
 * two different strings depending on which path ran: `PriceDisplay` prefers
 * the API's pre-formatted value ("600 kr") and falls back to `formatPrice`,
 * an `Intl.NumberFormat` currency format ("600,00 kr" with a non-breaking
 * space). Asserting the string asserts which path ran, not what the price is.
 *
 * Throws on text with no digits rather than returning `NaN`, which compares
 * false against everything and would read as a wrong price instead of a
 * missing element.
 *
 * Assumes the sv-SE convention the app formats in: comma decimal mark, space
 * thousands separator. A locale that groups with periods would need this to
 * know which separator it is looking at.
 */
export function parsePrice(text: string): number {
  const digits = text.replace(/[^\d,.]/g, '');
  if (!/\d/.test(digits)) {
    throw new Error(`no number in rendered price: ${JSON.stringify(text)}`);
  }
  // Comma is the decimal mark in sv-SE; the thousands separator is a space,
  // already dropped above.
  return Number.parseFloat(digits.replace(',', '.'));
}

/** Reads a rendered price off the page and returns it as a number. */
export async function readPrice(locator: Locator): Promise<number> {
  await expect(locator).toBeVisible({ timeout: 15000 });
  return parsePrice((await locator.innerText()).trim());
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
