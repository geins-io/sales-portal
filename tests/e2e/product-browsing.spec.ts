import { test, expect } from '@playwright/test';
import {
  discoverCategory,
  discoverProduct,
  discoverPurchasableProduct,
  fetchProductListRows,
  fetchProductPrice,
  readPrice,
  waitForHydration,
  hasE2ECredentials,
  outOfScope,
  STORAGE_STATE,
} from './helpers';
import { BASE_URL } from './target';

/**
 * Product Browsing E2E Tests
 *
 * Tests the PLP → PDP journey: category navigation, product grid,
 * sorting, filtering, and product detail pages.
 */

test.describe('Product Browsing', () => {
  test('should navigate to a category and show product grid', async ({
    page,
  }) => {
    const category = await discoverCategory(page);

    await page.goto(`/${category.alias}`);

    // Product cards should render
    const cards = page.locator('[data-testid="product-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 20000 });

    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should switch between grid and list views', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load first
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });

    // The toolbar renders ViewToggle with no `v-if`, so the guard this used
    // to sit behind could never be false — and hid whether the toggle works.
    const viewToggle = page.locator('[data-testid="view-toggle"]');
    await expect(viewToggle).toBeVisible({ timeout: 15000 });

    const listButton = viewToggle.locator('button').nth(1);
    await listButton.click();

    // Product cards should still be visible (in list layout)
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible();
  });

  test('should have a sort dropdown', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load first
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });

    // Wait for hydration so Select component is interactive
    await waitForHydration(page);

    // Rendered unconditionally by ProductListToolbar; the old guard made a
    // missing dropdown indistinguishable from a passing test.
    const sortDropdown = page.locator('[data-testid="sort-dropdown"]');
    await expect(sortDropdown).toBeVisible({ timeout: 15000 });

    // Retry click — hydration mismatch patching can cause first click to miss
    const options = page.locator('[role="option"]');
    for (let attempt = 0; attempt < 3; attempt++) {
      await sortDropdown.click();
      const visible = await options
        .first()
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (visible) break;
      // Close the dropdown if it opened empty, then retry
      await page.keyboard.press('Escape');
    }
    await expect(options.first()).toBeVisible({ timeout: 5000 });
  });

  test('should have a filter button', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load first
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });

    // The sheet opens via a Vue handler — unhydrated, the click is inert.
    await waitForHydration(page);

    // ProductFilters renders only `v-if="facets && facets.length > 0"`
    // (ProductList.vue), so a category with no facets has no filter button.
    // A real state, declared rather than returned from silently.
    const filterButton = page.locator('[data-testid="product-filters"]');
    outOfScope(
      !(await filterButton.isVisible().catch(() => false)),
      'fixture-missing',
      'discovered category exposes no facets, so no filter button renders',
    );

    await filterButton.click();

    const filterSheet = page.locator('[role="dialog"]');
    await expect(filterSheet).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to PDP from product card', async ({ page }) => {
    const product = await discoverProduct(page);

    await page.goto(`/p/${product.alias}`);

    const gallery = page.locator('[data-testid="product-gallery"]');
    await expect(gallery).toBeVisible({ timeout: 20000 });
  });

  test('should show the product title on PDP', async ({ page }) => {
    const product = await discoverProduct(page);

    await page.goto(`/p/${product.alias}`);

    // The product's own heading, not any h1: the header and the print header
    // both render the brand name, so a bare `h1` is ambiguous.
    const heading = page.locator('[data-testid="product-name"]');
    await expect(heading).toBeVisible({ timeout: 15000 });
    await expect(heading).not.toBeEmpty();
  });

  test('should render product tabs on PDP', async ({ page }) => {
    const product = await discoverProduct(page);

    await page.goto(`/p/${product.alias}`);
    await page.waitForLoadState('load');
    await waitForHydration(page);

    // ProductTabs.vue has no `v-if` on its root, and the documents tab and
    // its accordion item render unconditionally — so the container always has
    // content. The guard this test used to open with could never be true,
    // which left "should render product tabs" asserting nothing at all.
    const tabs = page.locator('[data-testid="product-tabs"]');
    await expect(tabs).toBeVisible({ timeout: 15000 });

    // ProductTabs renders Tabs at >= md and an Accordion below, hiding one by
    // CSS. Both stay in the DOM, so branch on what is actually visible.
    const tabTriggers = tabs.locator('[role="tab"]');
    const isDesktopLayout = await tabTriggers
      .first()
      .isVisible()
      .catch(() => false);

    if (isDesktopLayout) {
      await tabTriggers.first().click();

      // One panel per tab, so an unscoped locator fails strict mode.
      const tabPanel = tabs.locator('[role="tabpanel"]').first();
      await expect(tabPanel).toBeVisible({ timeout: 5000 });
    } else {
      // Mobile accordion: expanding a section is the equivalent affordance.
      // The documents item is unconditional, so there is always one.
      const sections = tabs.locator('button[aria-expanded]');
      await expect(sections.first()).toBeVisible({ timeout: 5000 });

      const firstSection = sections.first();
      await expect(firstSection).toHaveAttribute('aria-expanded', 'false');
      await firstSection.click();
      await expect(firstSection).toHaveAttribute('aria-expanded', 'true', {
        timeout: 5000,
      });
    }
  });

  // Own block so the surrounding tests stay anonymous — only this one needs
  // a session, since add-to-cart is gated on `orderPlacement`.
  test.describe('purchase affordance (authenticated)', () => {
    outOfScope(
      !hasE2ECredentials(),
      'no-credentials',
      'add-to-cart needs an authenticated customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
    );
    test.use({ storageState: STORAGE_STATE });

    test('should show add-to-cart button on PDP', async ({ page }) => {
      const product = await discoverPurchasableProduct(page);

      await page.goto(`/p/${product.alias}`);

      const addButton = page
        .locator('[data-testid="add-to-cart-button"]')
        .first();
      await expect(addButton).toBeVisible({ timeout: 15000 });
    });
  });

  /**
   * Prices, compared against the numbers the API returned for the same
   * product. The recipe other value specs follow:
   *
   * - read the expected numbers from the API with `fetchProductPrice`, which
   *   refuses to return anything that is not a finite number;
   * - read the rendered value with `readPrice`, which parses the digits out —
   *   never compare formatted strings, the same amount reaches the DOM as
   *   "600 kr" or "600,00 kr" depending on which format path ran;
   * - assert both sides of every flag, not only the permissive one;
   * - pair every "this is absent" with a "this is present" on the same page,
   *   or the absence passes on a page that never rendered.
   */
  test.describe('prices (authenticated)', () => {
    outOfScope(
      !hasE2ECredentials(),
      'no-credentials',
      'priceVisibility is authenticated-only here (set E2E_USERNAME / E2E_PASSWORD in .env)',
    );
    test.use({ storageState: STORAGE_STATE });

    test('PDP shows the ex-VAT amount the API returned', async ({ page }) => {
      const product = await discoverProduct(page);
      const expected = await fetchProductPrice(page, product.alias);

      await page.goto(`/p/${product.alias}`);
      await waitForHydration(page);

      // vat_display defaults to 'ex' (app/composables/useVatDisplay.ts), so a
      // fresh context must show the ex-VAT number, not the inc-VAT one.
      const rendered = await readPrice(
        page.locator('[data-testid="pdp-price"]'),
      );
      expect(rendered).toBeCloseTo(expected.exVat, 2);

      // The API's own three numbers must agree, or the expectation above is
      // measured against a moving target.
      expect(expected.incVat - expected.exVat).toBeCloseTo(expected.vat, 2);
    });

    test('PDP shows the inc-VAT amount when the VAT cookie says inc', async ({
      page,
      context,
    }) => {
      const product = await discoverProduct(page);
      const expected = await fetchProductPrice(page, product.alias);

      await context.addCookies([
        { name: 'vat_display', value: 'inc', url: BASE_URL },
      ]);

      await page.goto(`/p/${product.alias}`);
      await waitForHydration(page);

      const rendered = await readPrice(
        page.locator('[data-testid="pdp-price"]'),
      );
      // Asserting the other side too: a toggle that swaps the label and not
      // the number passes a test that only checks the default.
      expect(rendered).toBeCloseTo(expected.incVat, 2);
      if (expected.vat > 0) {
        // Only meaningful when the two amounts differ. A zero-VAT product has
        // incVat === exVat, and `discoverProduct` picks by alias order with no
        // regard for that, so this half would fail on a correct page.
        expect(rendered).not.toBeCloseTo(expected.exVat, 2);
      }
    });

    test('PLP card and PDP show the same ex-VAT amount as the API', async ({
      page,
    }) => {
      // Identify the card through the article number, which the grid renders
      // and the list endpoint returns. Two things that do not work: the
      // product `discoverProduct` picks need not be on the page, and the
      // card's link carries the canonical URL, not the alias `/api/products`
      // takes.
      await page.goto('/products');
      await waitForHydration(page);

      const cards = page.locator('[data-testid="product-card"]');
      await expect(cards.first()).toBeVisible({ timeout: 20000 });

      // Read the catalogue after navigating, so the helper can take the market
      // and locale off the page's own URL and read what the grid read. Whole
      // catalogue rather than a page: the endpoint's ordering drifts between
      // calls, so two partial reads are two draws, and their overlap has
      // measured as low as zero.
      const rows = await fetchProductListRows(page);
      expect(rows.length, 'no product-list row has a price').toBeGreaterThan(0);

      // Match on the card's own article-number node, not on the whole card
      // text: one article number can be a prefix of another, and a substring
      // match over the card would then pick the wrong card silently.
      const shown = await cards
        .locator('[data-testid="article-number"]')
        .allInnerTexts();

      const row = rows.find((r) =>
        shown.some((text) => text.includes(r.articleNumber)),
      );
      expect(row, 'no catalogue row matched any card on the grid').toBeTruthy();

      const card = cards
        .filter({
          has: page.locator('[data-testid="article-number"]', {
            hasText: row!.articleNumber,
          }),
        })
        .first();
      const onGrid = await readPrice(
        card.locator('[data-testid="card-price"]'),
      );
      expect(onGrid).toBeCloseTo(row!.exVat, 2);

      await page.goto(`/p/${row!.alias}`);
      await waitForHydration(page);
      const onDetail = await readPrice(
        page.locator('[data-testid="pdp-price"]'),
      );

      // The grid and the detail page format independently; the number must
      // survive both, and both must equal what the API returned.
      expect(onDetail).toBeCloseTo(row!.exVat, 2);
      expect(onDetail).toBeCloseTo(onGrid, 2);
    });
  });

  test.describe('prices (anonymous)', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('PDP renders the product but no price', async ({ page }) => {
      const product = await discoverProduct(page);

      await page.goto(`/p/${product.alias}`);
      await waitForHydration(page);

      // The positive half is what makes the negative half mean anything: a
      // bare "no price" assertion passes on a page that 404'd.
      await expect(page.locator('[data-testid="product-name"]')).toBeVisible({
        timeout: 15000,
      });
      await expect(page.locator('[data-testid="pdp-price"]')).toHaveCount(0);
    });

    test('PLP renders cards but no prices', async ({ page }) => {
      const category = await discoverCategory(page);

      await page.goto(`/${category.alias}`);
      await waitForHydration(page);

      const cards = page.locator('[data-testid="product-card"]');
      await expect(cards.first()).toBeVisible({ timeout: 20000 });
      // `card-price` is the PriceDisplay instance the visibility rule gates.
      // The older `price` id sits on ProductCard's brief-item branch, which
      // goes through no gate at all, so asserting that one would prove
      // nothing about priceVisibility.
      await expect(page.locator('[data-testid="card-price"]')).toHaveCount(0);
    });
  });

  test('should filter products by price and return to full list on clear', async ({
    page,
  }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await waitForHydration(page);

    const initialCount = await page
      .locator('[data-testid="product-card"]')
      .count();

    // Open filter panel
    const filterButton = page.locator('[data-testid="product-filters"]');
    outOfScope(
      !(await filterButton.isVisible().catch(() => false)),
      'fixture-missing',
      'discovered category exposes no facets, so no filter button renders',
    );

    await filterButton.click();
    const filterSheet = page.locator('[role="dialog"]');
    await expect(filterSheet).toBeVisible({ timeout: 5000 });

    // Find and click a price filter checkbox. A facet can be a range rather
    // than a checkbox list, so its absence is a real state, not a defect.
    const checkbox = filterSheet.locator('[role="checkbox"]').first();
    outOfScope(
      !(await checkbox.isVisible().catch(() => false)),
      'fixture-missing',
      'category facets offer no checkbox filter to toggle',
    );

    await checkbox.click();

    // Wait for product list to update via API
    await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/api/product-lists/products') &&
          resp.status() === 200,
        { timeout: 15000 },
      )
      .catch(() => {
        // Filter may update without a separate API call
      });

    // Close the filter sheet by pressing Escape
    await page.keyboard.press('Escape');
    await expect(filterSheet).not.toBeVisible({ timeout: 5000 });

    // Verify product count changed (may have decreased or stayed the same if filter matches all)
    const filteredCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    expect(filteredCount).toBeGreaterThan(0);

    // Re-open filter panel and clear all filters
    await filterButton.click();
    await expect(filterSheet).toBeVisible({ timeout: 5000 });

    const clearButton = filterSheet
      .locator('button')
      .filter({ hasText: 'Rensa alla' })
      .last();
    await clearButton.scrollIntoViewIfNeeded();
    await clearButton.click({ force: true });

    // Wait for product list to update
    await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/api/product-lists/products') &&
          resp.status() === 200,
        { timeout: 15000 },
      )
      .catch(() => {});

    await page.keyboard.press('Escape');
    await expect(filterSheet).not.toBeVisible({ timeout: 5000 });

    // Verify count returns to original
    const restoredCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    expect(restoredCount).toBe(initialCount);
  });

  test('should filter products by text search and clear', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await waitForHydration(page);

    const initialCount = await page
      .locator('[data-testid="product-card"]')
      .count();

    // Rendered unconditionally by ProductListToolbar. Located by test id
    // rather than by placeholder: the placeholder is translated copy, so a
    // locale change would break the locator and read as a missing input.
    const searchInput = page.locator('[data-testid="quick-filter-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    await searchInput.fill('test');

    // Wait for debounce (300ms) + API refetch
    await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/api/product-lists/products') &&
          resp.status() === 200,
        { timeout: 15000 },
      )
      .catch(() => {});

    // Wait a bit for DOM update
    await page.waitForTimeout(500);

    // Product count should have changed (could be 0 or fewer)
    const filteredCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    // The search may filter to 0 or fewer products
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // Clear the search input
    await searchInput.clear();

    // Wait for refetch
    await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/api/product-lists/products') &&
          resp.status() === 200,
        { timeout: 15000 },
      )
      .catch(() => {});

    await page.waitForTimeout(500);

    // Verify products return to original count
    const restoredCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    expect(restoredCount).toBe(initialCount);
  });

  test('should navigate to PDP with locale prefix in URL', async ({ page }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await waitForHydration(page);

    // Click the first product card link
    const productLink = page.locator('[data-testid="product-card"] a').first();
    await productLink.click();

    // Wait for navigation to complete
    await page.waitForLoadState('load', { timeout: 15000 });

    // Verify URL contains a locale prefix (e.g., /se/sv/ or /se/en/)
    const url = page.url();
    expect(url).toMatch(/\/[a-z]{2}\/[a-z]{2}\//);

    // Verify it's NOT the homepage (product click shouldn't redirect to home)
    expect(url).not.toMatch(/\/[a-z]{2}\/[a-z]{2}\/$/);

    // Verify PDP content loads (the product's own heading)
    const heading = page.locator('[data-testid="product-name"]');
    await expect(heading).toBeVisible({ timeout: 15000 });
    await expect(heading).not.toBeEmpty();
  });

  test('should return to category from PDP breadcrumb with products visible', async ({
    page,
  }) => {
    const category = await discoverCategory(page);
    await page.goto(`/${category.alias}`);

    // Wait for products to load
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await waitForHydration(page);

    // Navigate to a PDP by clicking the first product
    const productLink = page.locator('[data-testid="product-card"] a').first();
    await productLink.click();

    // Wait for PDP to load
    const heading = page.locator('[data-testid="product-name"]');
    await expect(heading).toBeVisible({ timeout: 15000 });

    // The PDP is rendered once its breadcrumbs carry the category link; the
    // category page's crumbs stay in the DOM until then, so the heading check
    // above alone does not prove the PDP is up.
    const categoryCrumb = page
      .locator('[data-testid="breadcrumbs"] a[href*="/c/"]')
      .last();
    await expect(categoryCrumb).toBeVisible({ timeout: 15000 });
    await categoryCrumb.click();

    // Wait for category page to load with products
    await expect(
      page.locator('[data-testid="product-card"]').first(),
    ).toBeVisible({ timeout: 20000 });

    const productCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    expect(productCount).toBeGreaterThan(0);
  });
});
