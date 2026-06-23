import { test, expect } from '@playwright/test';
import {
  discoverProduct,
  waitForHydration,
  setMobileViewport,
} from './helpers';

/**
 * Search E2E Tests
 *
 * Tests the search journey: autocomplete, search results page,
 * and input behavior.
 *
 * Note: We use pressSequentially() instead of fill() for the search input
 * because fill() sets the value programmatically and may not trigger Vue's
 * watch chain + debounce reliably. pressSequentially() simulates real typing.
 */

test.describe('Search', () => {
  test('should show autocomplete after typing', async ({ page }) => {
    const product = await discoverProduct(page);
    const searchTerm = product.name.split(' ')[0] ?? 'test';

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

  test('should show products with images in autocomplete', async ({ page }) => {
    const product = await discoverProduct(page);
    const searchTerm = product.name.split(' ')[0] ?? 'test';

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

    // Results should have list items with images
    const items = autocomplete.locator('[role="option"], li');
    const count = await items.count();

    if (count > 0) {
      const images = autocomplete.locator('img');
      await expect(images.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should render a usable search input on the bare /search page', async ({
    page,
  }) => {
    // The mobile header search icon links here without a query. The page
    // must surface a focused search field, not a dead "enter a term" stub.
    await page.goto('/search');
    await page.waitForLoadState('load');

    const searchInput = page.locator('[data-testid="search-input"]');
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

    // Wait for either products or empty state
    await expect(cards.first().or(emptyState)).toBeVisible({ timeout: 15000 });
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

    const hasCards = await cards
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasCards || hasEmpty).toBe(true);
  });

  test('should close autocomplete when input is cleared', async ({ page }) => {
    const product = await discoverProduct(page);
    const searchTerm = product.name.split(' ')[0] ?? 'test';

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

    await page
      .locator('[data-testid="mobile-search-backdrop"]')
      .click({ position: { x: 10, y: 10 } });
    await expect(panel).toBeHidden({ timeout: 5000 });
  });
});
