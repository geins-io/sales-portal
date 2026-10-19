import { test, expect, type Page } from './fixtures';
import {
  discoverProduct,
  discoverPurchasableProduct,
  fetchCart,
  hasE2ECredentials,
  outOfScope,
  waitForHydration,
  setMobileViewport,
  signedInState,
} from './helpers';
import { BASE_URL } from './target';

/**
 * Search E2E Tests
 *
 * Tests the search journey: autocomplete, search results page,
 * and input behavior.
 *
 * Note: We use pressSequentially() instead of fill() for the search input
 * because fill() sets the value programmatically and may not trigger Vue's
 * watch chain + debounce reliably. pressSequentially() simulates real typing.
 *
 * Viewport: the header SearchBar is `hidden … lg:flex`, so tests driving it
 * skip on mobile projects rather than resizing — resizing would report mobile
 * coverage while running a desktop test. Mobile has its own block below.
 */

test.describe('Search', () => {
  test('should show autocomplete after typing', async ({ page, isMobile }) => {
    const product = await discoverProduct(page);
    const searchTerm = product.name.split(' ')[0] ?? 'test';

    outOfScope(
      isMobile,
      'mobile-project',
      'header search is desktop-only (hidden below lg)',
    );

    await page.goto('/');
    await page.waitForLoadState('load');

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // Wait for Vue hydration so v-model and watch are active
    await waitForHydration(page);

    await searchInput.click();
    await searchInput.pressSequentially(searchTerm, { delay: 50 });

    // Wait for debounce (300ms) + API response
    const autocomplete = page.locator('[data-testid="search-autocomplete"]');
    await expect(autocomplete).toBeVisible({ timeout: 15000 });
  });

  test('should show products with images in autocomplete', async ({
    page,
    isMobile,
  }) => {
    const product = await discoverProduct(page);
    const searchTerm = product.name.split(' ')[0] ?? 'test';

    outOfScope(
      isMobile,
      'mobile-project',
      'header search is desktop-only (hidden below lg)',
    );

    await page.goto('/');
    await page.waitForLoadState('load');

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // Wait for Vue hydration so v-model and watch are active
    await waitForHydration(page);

    await searchInput.click();
    await searchInput.pressSequentially(searchTerm, { delay: 50 });

    const autocomplete = page.locator('[data-testid="search-autocomplete"]');
    await expect(autocomplete).toBeVisible({ timeout: 15000 });

    // The panel opens on the loading state too (`v-if="open"`), so waiting
    // for the container proves nothing about results — counting straight
    // after it counts the spinner. Wait for an option, which retries past
    // loading; the search term comes from a product discoverProduct just
    // returned, so one is expected.
    const items = autocomplete.locator('li[role="option"]');
    await expect(items.first()).toBeVisible({ timeout: 15000 });

    const images = autocomplete.locator('img');
    await expect(images.first()).toBeVisible({ timeout: 5000 });
  });

  test('should render a usable search input on the bare /search page', async ({
    page,
  }) => {
    // The mobile header search icon links here without a query. The page
    // must surface a focused search field, not a dead "enter a term" stub.
    await page.goto('/search');
    await page.waitForLoadState('load');

    // Scoped to `main`: the header has its own SearchBar with the same testid,
    // so an unscoped locator fails strict mode before visibility is evaluated.
    const searchInput = page.locator('main [data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to search results page on submit', async ({ page }) => {
    const product = await discoverProduct(page);
    const searchTerm = product.name.split(' ')[0] ?? 'test';

    // Navigate directly to search results page
    await page.goto(`/search?q=${encodeURIComponent(searchTerm)}`);

    // Products should appear on search results page
    const cards = page.locator('[data-testid="product-card"]');
    const emptyState = page.locator('[data-testid="search-empty"]');

    // The term is the first word of a product the catalogue API just
    // returned, so an empty result is not a state this search reaches.
    // `cards.first().or(emptyState)` accepted it — the same defect as the
    // or-assertion below, written with Playwright's `.or()`.
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    await expect(emptyState).toBeHidden();
  });

  test('should show search results page with products', async ({ page }) => {
    const product = await discoverProduct(page);
    const searchTerm = product.name.split(' ')[0] ?? 'test';

    await page.goto(`/search?q=${encodeURIComponent(searchTerm)}`);

    // Wait for loading to finish
    const loadingIndicator = page.locator('[data-testid="search-loading"]');
    if (await loadingIndicator.isVisible().catch(() => false)) {
      await expect(loadingIndicator).toBeHidden({ timeout: 15000 });
    }

    // Check for products or empty state
    const cards = page.locator('[data-testid="product-card"]');
    const emptyState = page.locator('[data-testid="search-empty"]');

    // The term is the first word of a product the catalogue API just
    // returned, so an empty result is not a state this search reaches:
    // `hasCards || hasEmpty` passed on a search that found nothing.
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    await expect(emptyState).toBeHidden();
  });

  test('should close autocomplete when input is cleared', async ({
    page,
    isMobile,
  }) => {
    const product = await discoverProduct(page);
    const searchTerm = product.name.split(' ')[0] ?? 'test';

    outOfScope(
      isMobile,
      'mobile-project',
      'header search is desktop-only (hidden below lg)',
    );

    await page.goto('/');
    await page.waitForLoadState('load');

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // Wait for Vue hydration so v-model and watch are active
    await waitForHydration(page);

    // Type to open autocomplete
    await searchInput.click();
    await searchInput.pressSequentially(searchTerm, { delay: 50 });

    const autocomplete = page.locator('[data-testid="search-autocomplete"]');
    await expect(autocomplete).toBeVisible({ timeout: 15000 });

    // Clear input — use keyboard shortcut to select all + delete
    await searchInput.fill('');

    // Autocomplete should close
    await expect(autocomplete).toBeHidden({ timeout: 5000 });
  });
});

test.describe('Mobile search overlay', () => {
  test('search icon toggles a dropdown overlay with backdrop, not a page nav', async ({
    page,
  }) => {
    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const trigger = page.locator('[data-slot="search-button"]');
    const panel = page.locator('[data-testid="mobile-search-panel"]');
    const backdrop = page.locator('[data-testid="mobile-search-backdrop"]');
    const input = panel.locator('[data-testid="search-input"]');

    // Closed by default, and tapping never triggers a page navigation.
    await expect(trigger).toBeVisible({ timeout: 15000 });
    await expect(panel).toBeHidden();

    // Tap opens the overlay below the header with a dark backdrop, and the
    // field is focused so a query can be typed immediately.
    await trigger.click();
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(backdrop).toBeVisible();
    await expect(input).toBeFocused();
    await expect(page).toHaveURL(/\/$/);

    // Tapping the icon again closes it.
    await trigger.click();
    await expect(panel).toBeHidden({ timeout: 5000 });
    await expect(backdrop).toBeHidden();
  });

  test('typing in the overlay shows the same autocomplete as desktop', async ({
    page,
  }) => {
    const product = await discoverProduct(page);
    const searchTerm = product.name.split(' ')[0] ?? 'test';

    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    await page.locator('[data-slot="search-button"]').click();

    const input = page.locator(
      '[data-testid="mobile-search-panel"] [data-testid="search-input"]',
    );
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.pressSequentially(searchTerm, { delay: 50 });

    const autocomplete = page.locator('[data-testid="search-autocomplete"]');
    await expect(autocomplete).toBeVisible({ timeout: 15000 });
  });

  test('tapping the backdrop closes the overlay', async ({ page }) => {
    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    await page.locator('[data-slot="search-button"]').click();
    const panel = page.locator('[data-testid="mobile-search-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // The backdrop spans the viewport, so {10,10} lands behind the sticky
    // header. Tap low on it instead — the area a user actually taps.
    const backdrop = page.locator('[data-testid="mobile-search-backdrop"]');
    const box = await backdrop.boundingBox();
    expect(box, 'backdrop should have a layout box').not.toBeNull();
    await backdrop.click({
      position: { x: box!.width / 2, y: box!.height - 20 },
    });
    await expect(panel).toBeHidden({ timeout: 5000 });
  });
});

test.describe('Search results add to cart', () => {
  // Declared before `test.use`, not inside the test body: `storageState` is
  // resolved during fixture setup, which happens before the body runs. A
  // check inside the body is therefore too late to prevent the login state
  // from being read, and without credentials that file was never written —
  // the test fails on the missing file instead of reporting itself out of scope. Same
  // order as cart.spec.ts.
  outOfScope(
    !hasE2ECredentials(),
    'no-credentials',
    'add-to-cart needs an authenticated customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
  );

  test.use({ storageState: signedInState });

  /** The caller's cart lines with the ids a cleanup needs. */
  async function cartLines(page: Page): Promise<{
    cartId?: string;
    lines: { id: string; skuId: number; quantity: number }[];
  }> {
    // This host's cookie whether or not the page has navigated yet: before the
    // first goto `page.url()` is about:blank and matches no cookie, and the
    // stored state may hold other tenants' carts.
    const cartId = (await page.context().cookies(BASE_URL)).find(
      (cookie) => cookie.name === 'cart_id',
    )?.value;
    if (!cartId) return { lines: [] };
    const response = await page.request.get('/api/cart', {
      params: { cartId },
    });
    expect(response.ok(), '/api/cart did not answer 200').toBe(true);
    return { cartId, lines: (await response.json())?.items ?? [] };
  }

  /** Puts the cart back as `before` read it: new lines out, grown ones back. */
  async function restoreCart(
    page: Page,
    before: Awaited<ReturnType<typeof cartLines>>,
  ): Promise<void> {
    const now = await cartLines(page);
    for (const line of now.lines) {
      const was = before.lines.find((b) => b.id === line.id);
      if (!was) {
        await page.request.delete('/api/cart/items', {
          params: { cartId: now.cartId!, itemId: line.id },
        });
      } else if (was.quantity !== line.quantity) {
        await page.request.put('/api/cart/items', {
          data: {
            cartId: now.cartId!,
            itemId: line.id,
            quantity: was.quantity,
          },
        });
      }
    }
  }

  test('a search result card adds its product to the cart', async ({
    page,
  }) => {
    // The search ranks no result reliably first, so the test takes whichever
    // card can be bought and follows that card's own product into the cart.
    const product = await discoverPurchasableProduct(page);
    const before = await cartLines(page);

    // Not try/finally: a cleanup that throws there replaces the test's error.
    let failure: unknown;
    try {
      await page.goto(`/search?q=${encodeURIComponent(product.name)}`);
      await waitForHydration(page);

      // Only a buyable card renders the button: a configurable one links to
      // its configurator, an out-of-stock one shows the stock block.
      const card = page
        .locator('[data-testid="product-card"]:visible')
        .filter({
          has: page.locator('[data-testid="add-to-cart-button"]:enabled'),
        })
        .filter({ has: page.locator('[data-testid="article-number"]') })
        .first();
      await expect(card).toBeVisible({ timeout: 15000 });
      const cardArticle = (
        await card.getByTestId('article-number').innerText()
      ).trim();
      expect(cardArticle, 'the card shows no article number').not.toBe('');

      const added = page.waitForResponse(
        (r) =>
          r.url().includes('/api/cart/items') &&
          r.request().method() === 'POST',
      );
      await card.getByTestId('add-to-cart-button').click();
      expect((await added).ok(), 'POST /api/cart/items failed').toBe(true);

      // The line the click made, or grew when the cart already held the SKU.
      const cart = await fetchCart(page);
      const { lines } = await cartLines(page);
      const changed = lines.filter(
        (line) =>
          (before.lines.find((b) => b.id === line.id)?.quantity ?? 0) <
          line.quantity,
      );
      expect(changed, 'the click changed no cart line').toHaveLength(1);
      const apiLine = cart.items.find(
        (item) => item.skuId === changed[0]!.skuId,
      );
      expect(apiLine, 'the cart API holds no line for that SKU').toBeTruthy();
      expect(cardArticle).toContain(apiLine!.articleNumber);

      const drawer = page.locator('[data-testid="cart-drawer"]');
      await expect(
        drawer
          .locator('[data-testid="cart-item-article"]')
          .filter({ hasText: apiLine!.articleNumber }),
      ).toBeVisible({ timeout: 10000 });
    } catch (error) {
      failure = error;
    }

    const cleanup = await restoreCart(page, before).then(
      () => undefined,
      (error: Error) => error,
    );
    if (failure) {
      if (cleanup) {
        test.info().annotations.push({
          type: 'cleanup',
          description: `cart cleanup failed: ${cleanup.message}`,
        });
      }
      throw failure;
    }
    if (cleanup) throw cleanup;
  });
});
