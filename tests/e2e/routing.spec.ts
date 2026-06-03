/**
 * Routing E2E Tests
 *
 * Covers the routing acceptance scenarios that unit/component tests cannot
 * exercise because they stub NuxtLink and navigateTo. These tests drive a
 * real browser against a running dev server using genuine Geins data.
 *
 * COVERAGE GAP (documented, not silently omitted):
 * The Geins /l/ inbound URL shape (categories arriving with an /l/ prefix
 * from production Geins canonical URLs) and the renamed-slug urlHistory 301
 * redirect are specific to tinatest (the production Geins tenant) and cannot
 * be reproduced on the prefix-less tenant-a dev fixture. Both scenarios are
 * covered by the in-suite resolver and middleware unit tests (specs 002, 003)
 * and are verified manually against tinatest during each release walkthrough.
 * The tests below cover tenant-a only: /c/ prefix shape on language switch
 * and URL stability on hard refresh.
 */

import { test, expect } from '@playwright/test';
import { discoverCategory, discoverProduct, waitForHydration } from './helpers';

test.describe('Routing', () => {
  test('language switch on a category lands on /c/ and renders target language', async ({
    page,
  }) => {
    // Discover a real category from Geins data; skip if none is available
    let category: Awaited<ReturnType<typeof discoverCategory>>;
    try {
      category = await discoverCategory(page);
    } catch {
      test.skip(true, 'No discoverable category on this tenant; skipping');
      return;
    }

    await page.goto(`/${category.alias}`);
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);

    // Open the switcher if it is a dropdown (trigger has change-language aria-label).
    // Use a broader selector: any button whose aria-label contains language/byt.
    const langTrigger = page
      .locator('button')
      .filter({ hasNot: page.locator('[data-testid="locale-switcher-link"]') })
      .and(
        page.locator(
          '[aria-label*="language" i], [aria-label*="spr" i], [aria-label*="Change" i]',
        ),
      )
      .first();

    const isDropdown =
      (await langTrigger.isVisible().catch(() => false)) &&
      (await page
        .locator('[data-testid="locale-switcher-link"]')
        .first()
        .isVisible()
        .catch(() => false)) === false;

    if (isDropdown) {
      await langTrigger.click();
      // Wait a tick for the dropdown content to render
      await page.waitForTimeout(300);
    }

    // Collect all locale switcher links
    const switcherLinks = page.locator('[data-testid="locale-switcher-link"]');
    const linkCount = await switcherLinks.count();

    if (linkCount <= 1) {
      test.skip(
        true,
        'Tenant has a single locale; language switch test does not apply',
      );
      return;
    }

    // Determine current locale from the URL (segment index 2: /se/{locale}/...)
    const currentUrl = new URL(page.url());
    const segments = currentUrl.pathname.split('/').filter(Boolean);
    // segments[0] = market (e.g. 'se'), segments[1] = locale (e.g. 'sv')
    const currentLocale = segments[1] ?? '';

    // Pick a target link whose data-locale differs from the current locale
    let targetLink: ReturnType<typeof page.locator> | null = null;
    let targetLocale = '';

    for (let i = 0; i < linkCount; i++) {
      const link = switcherLinks.nth(i);
      const loc = await link.getAttribute('data-locale');
      if (loc && loc !== currentLocale) {
        targetLink = link;
        targetLocale = loc;
        break;
      }
    }

    if (!targetLink || !targetLocale) {
      test.skip(
        true,
        'Could not find a locale link different from current; skipping',
      );
      return;
    }

    // Core assertion (spec 001 fix): the href must carry the /c/ prefix,
    // NOT /l/ and NOT prefix-less.
    const href = await targetLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/^\/[a-z]{2}\/[a-z]{2}\/c\//);

    // Capture the document response on click to assert no 404
    const [resp] = await Promise.all([
      page
        .waitForResponse(
          (r) =>
            r.request().resourceType() === 'document' &&
            r.url().includes('/c/'),
          { timeout: 30000 },
        )
        .catch(() => null),
      targetLink.click(),
    ]);

    await page.waitForLoadState('domcontentloaded');

    // Assert no 404 from the document response (may be null if timing varies)
    if (resp) {
      expect(resp.status()).toBeLessThan(400);
    }

    // Assert URL moved to the target locale under /c/
    const afterUrl = new URL(page.url());
    expect(afterUrl.pathname).toMatch(new RegExp(`^/se/${targetLocale}/c/`));

    // Assert a PLP render marker is visible and the 404 page is not shown
    const plpMarker = page
      .locator('[data-testid="breadcrumbs"], [data-testid="product-card"], h1')
      .first();
    await expect(plpMarker).toBeVisible({ timeout: 20000 });

    // Confirm we are not on a 404 page
    const notFound = page.locator('text=404').first();
    const isNotFoundVisible = await notFound.isVisible().catch(() => false);
    expect(isNotFoundVisible).toBe(false);
  });

  test('hard refresh of the switched /c/ page holds (no 404)', async ({
    page,
  }) => {
    // Discover a real category; skip if none available
    let category: Awaited<ReturnType<typeof discoverCategory>>;
    try {
      category = await discoverCategory(page);
    } catch {
      test.skip(true, 'No discoverable category; skipping');
      return;
    }

    await page.goto(`/${category.alias}`);
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);

    // Open switcher if dropdown
    const langTrigger = page
      .locator('button')
      .and(
        page.locator(
          '[aria-label*="language" i], [aria-label*="spr" i], [aria-label*="Change" i]',
        ),
      )
      .first();

    const isDropdown =
      (await langTrigger.isVisible().catch(() => false)) &&
      (await page
        .locator('[data-testid="locale-switcher-link"]')
        .first()
        .isVisible()
        .catch(() => false)) === false;

    if (isDropdown) {
      await langTrigger.click();
      await page.waitForTimeout(300);
    }

    const switcherLinks = page.locator('[data-testid="locale-switcher-link"]');
    const linkCount = await switcherLinks.count();

    if (linkCount <= 1) {
      test.skip(
        true,
        'Tenant has a single locale; hard-refresh test does not apply',
      );
      return;
    }

    const currentUrl = new URL(page.url());
    const segments = currentUrl.pathname.split('/').filter(Boolean);
    const currentLocale = segments[1] ?? '';

    let targetLink: ReturnType<typeof page.locator> | null = null;
    let targetLocale = '';

    for (let i = 0; i < linkCount; i++) {
      const link = switcherLinks.nth(i);
      const loc = await link.getAttribute('data-locale');
      if (loc && loc !== currentLocale) {
        targetLink = link;
        targetLocale = loc;
        break;
      }
    }

    if (!targetLink || !targetLocale) {
      test.skip(true, 'No alternative locale link found; skipping');
      return;
    }

    // Navigate to the switched locale URL
    await Promise.all([
      page
        .waitForResponse(
          (r) =>
            r.request().resourceType() === 'document' &&
            r.url().includes('/c/'),
          { timeout: 30000 },
        )
        .catch(() => null),
      targetLink.click(),
    ]);

    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);

    const urlBeforeReload = page.url();

    // Hard refresh
    await page.reload();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await waitForHydration(page);

    // PLP marker must still be visible after reload
    const plpMarker = page
      .locator('[data-testid="breadcrumbs"], [data-testid="product-card"], h1')
      .first();
    await expect(plpMarker).toBeVisible({ timeout: 20000 });

    // URL must be unchanged (canonical correction must not redirect away)
    expect(page.url()).toBe(urlBeforeReload);
  });

  test('product PDP refresh holds (canonical stable, no replaceState break)', async ({
    page,
  }) => {
    // Discover a real product; skip if none available
    let product: Awaited<ReturnType<typeof discoverProduct>>;
    try {
      product = await discoverProduct(page);
    } catch {
      test.skip(true, 'No discoverable product; skipping');
      return;
    }

    await page.goto(`/p/${product.alias}`);
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);

    // Product name must be visible before reload
    const productName = page.locator('[data-testid="product-name"]').first();
    await expect(productName).toBeVisible({ timeout: 20000 });

    // Capture the pathname before reload
    const before = new URL(page.url()).pathname;

    // Hard refresh
    await page.reload();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await waitForHydration(page);

    // Product name must still be visible after reload
    await expect(productName).toBeVisible({ timeout: 20000 });

    // URL must be unchanged: canonical correction must be a no-op for an
    // already-canonical slug and must never cause a 404 on refresh
    const after = new URL(page.url()).pathname;
    expect(after).toBe(before);
  });
});
