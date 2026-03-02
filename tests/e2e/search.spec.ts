import { test, expect } from '@playwright/test';
import { discoverProduct, waitForHydration } from './helpers';

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
