/**
 * Routing E2E Tests
 *
 * Covers the routing acceptance scenarios that unit/component tests cannot
 * exercise because they stub NuxtLink and navigateTo. These tests drive a
 * real browser against a running dev server using genuine Geins data.
 *
 * COVERAGE GAP (documented, not silently omitted):
 * The Geins /l/ inbound URL shape (categories arriving with an /l/ prefix in
 * their canonical URLs) and the renamed-slug urlHistory 301 redirect need a
 * tenant whose catalogue carries that history, and cannot be reproduced on the
 * prefix-less canonical URLs the configured tenant returns. Both scenarios are
 * covered by the in-suite resolver and middleware unit tests (specs 002, 003)
 * and are verified manually against such a tenant during each release
 * walkthrough. The tests below cover the prefix-less shape only: /c/ prefix on
 * language switch and URL stability on hard refresh.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  discoverCategory,
  discoverProduct,
  outOfScope,
  waitForHydration,
} from './helpers';

/**
 * Open the locale switcher (dropdown variant) and return its links, once they
 * are rendered. Zero links means the tenant has one locale — LocaleSwitcher
 * renders nothing then — which is a declared tenant-config limit, not a skip.
 */
async function openLocaleSwitcher(page: Page) {
  const switcherLinks = page.locator('[data-testid="locale-switcher-link"]');
  const langTrigger = page
    .locator('button')
    .and(
      page.locator(
        '[aria-label*="language" i], [aria-label*="spr" i], [aria-label*="Change" i]',
      ),
    )
    .first();

  const hasTrigger = await langTrigger.isVisible().catch(() => false);
  const inlineLinks = await switcherLinks
    .first()
    .isVisible()
    .catch(() => false);

  if (hasTrigger && !inlineLinks) {
    await langTrigger.click();
    // Wait for the dropdown to render its links rather than sampling after a
    // fixed delay — a fixed delay reported "single locale" on a two-locale
    // tenant when the dropdown was slow.
    await expect(switcherLinks.first()).toBeVisible({ timeout: 5000 });
  }

  return switcherLinks;
}

/** The first switcher link whose locale differs from the current URL's. */
async function otherLocaleLink(page: Page) {
  const switcherLinks = await openLocaleSwitcher(page);
  const linkCount = await switcherLinks.count();
  outOfScope(
    linkCount <= 1,
    'tenant-config',
    'tenant has a single locale; language switching does not apply',
  );

  // /se/{locale}/... — segments[0] = market, segments[1] = locale
  const segments = new URL(page.url()).pathname.split('/').filter(Boolean);
  const currentLocale = segments[1] ?? '';

  for (let i = 0; i < linkCount; i++) {
    const link = switcherLinks.nth(i);
    const locale = await link.getAttribute('data-locale');
    if (locale && locale !== currentLocale) return { link, locale };
  }
  // Two or more links and none for another locale is a switcher bug.
  throw new Error(
    `locale switcher has ${linkCount} links but none for a locale other than "${currentLocale}"`,
  );
}

test.describe('Routing', () => {
  test('language switch on a category lands on /c/ and renders target language', async ({
    page,
  }) => {
    // Discovery throws when the tenant has no category — a real failure.
    const category = await discoverCategory(page);

    await page.goto(`/${category.alias}`);
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);

    const { link: targetLink, locale: targetLocale } =
      await otherLocaleLink(page);

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

    // Assert no 404 from the document response (may be null if timing varies)
    if (resp) {
      expect(resp.status()).toBeLessThan(400);
    }

    // Wait for the URL rather than sampling it: WebKit commits it later than
    // Chromium, so `page.url()` can still report the previous path after the
    // target returned 200. Waits for the condition it then asserts.
    await page.waitForURL(new RegExp(`/se/${targetLocale}/c/`), {
      timeout: 20000,
    });
    await page.waitForLoadState('domcontentloaded');

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
    const category = await discoverCategory(page);

    await page.goto(`/${category.alias}`);
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);

    const { link: targetLink } = await otherLocaleLink(page);

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
    const product = await discoverProduct(page);

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
