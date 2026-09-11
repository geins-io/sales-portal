import { test, expect } from '@playwright/test';
import {
  setMobileViewport,
  discoverCategory,
  outOfScope,
  waitForHydration,
} from './helpers';

/**
 * Navigation E2E Tests
 *
 * Tests site navigation: header links, breadcrumbs, footer links,
 * and mobile navigation panel.
 */

/** Same page, ignoring a trailing slash: `/se/sv` and `/se/sv/` are one place. */
function samePath(a: string, b: string): boolean {
  return a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
}

test.describe('Navigation', () => {
  test('should have clickable header menu links', async ({
    page,
    isMobile,
  }) => {
    // Below lg the header carries no menu links at all — only the brand, which
    // points at the locale root, and viewport-gated links. Navigation there is
    // the hamburger panel, covered by the Mobile Navigation block.
    outOfScope(
      isMobile,
      'mobile-project',
      'header menu links are desktop-only; mobile navigates from the nav panel',
    );

    await page.goto('/');

    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: 15000 });

    const links = header.locator('a[href]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    // Hydration first: before the stylesheet has applied, a viewport-gated
    // element reads as visible (docs/testing.md), and this loop's whole job is
    // to tell visible links from hidden ones.
    await waitForHydration(page);

    // `/` was already redirected to `/{market}/{locale}/`, so "not the
    // homepage" proves nothing: the brand logo points at the locale root and
    // would satisfy it without going anywhere. Compare against where we are.
    const before = new URL(page.url()).pathname;

    // Click the first visible link that leaves this page. Header links are
    // viewport-gated — the apply-for-account link is `hidden sm:inline` — so
    // the first link in the DOM is not clickable everywhere.
    let clicked: string | undefined;
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute('href');
      if (!href || href.startsWith('http')) continue;
      if (href === '/' || samePath(href, before)) continue;
      if (!(await link.isVisible().catch(() => false))) continue;

      await link.click();
      clicked = href;
      break;
    }

    // Previously a loop that found nothing left the test passing with no
    // assertion at all.
    expect(
      clicked,
      `no visible header link pointed away from ${before}`,
    ).toBeDefined();

    // Client-side routing, so wait for the URL rather than a load event.
    await page
      .waitForURL((url) => !samePath(new URL(url).pathname, before), {
        timeout: 15000,
      })
      .catch(() => {});

    expect(
      samePath(new URL(page.url()).pathname, before),
      `clicking "${clicked}" should have navigated away from ${before}`,
    ).toBe(false);
  });

  test('should render breadcrumbs on category pages', async ({ page }) => {
    const category = await discoverCategory(page);

    await page.goto(`/${category.alias}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the page content to render
    await page.waitForLoadState('networkidle').catch(() => {
      // Fallback: networkidle may not fire if long-polling is active
    });

    // The test's name is the claim, so it carries it. Wrapping the assertion
    // in "if the breadcrumbs are there" made the one outcome worth reporting
    // — no breadcrumbs — the outcome that passes.
    const breadcrumbs = page.locator('[data-testid="breadcrumbs"]');
    await expect(breadcrumbs).toBeVisible({ timeout: 15000 });

    const items = breadcrumbs.locator('li');
    expect(await items.count()).toBeGreaterThanOrEqual(1);
  });

  test('should have clickable footer links', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 15000 });

    const links = footer.locator('a[href]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Mobile Navigation', () => {
  test('should open mobile nav panel from hamburger menu', async ({ page }) => {
    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const trigger = page.locator('[data-testid="mobile-nav-trigger"]');
    await expect(trigger).toBeVisible({ timeout: 15000 });

    await trigger.click();

    // Sheet renders via dialog portal — teleported to body
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 15000 });
  });

  test('should have navigation links in mobile panel', async ({ page }) => {
    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const trigger = page.locator('[data-testid="mobile-nav-trigger"]');
    await expect(trigger).toBeVisible({ timeout: 15000 });
    await trigger.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // A top-level category with children renders as a collapsible button, so
    // its `a[href]` only exists once expanded; one without children renders as
    // a plain link. Which shape appears is the tenant's category tree, not a
    // property of the app — so branch on what the menu produced. Both shapes
    // must end with a reachable category link.
    const sections = dialog.locator('button[aria-expanded]');
    const links = dialog.locator('a[href]');

    await expect(
      sections.or(links).first(),
      'the mobile panel showed neither a category link nor an expandable section',
    ).toBeVisible({ timeout: 5000 });

    if ((await sections.count()) > 0) {
      await sections.first().click();
    }

    await expect(links.first()).toBeVisible({ timeout: 5000 });
  });

  test('should close mobile nav on navigation', async ({ page }) => {
    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const trigger = page.locator('[data-testid="mobile-nav-trigger"]');
    await expect(trigger).toBeVisible({ timeout: 15000 });
    await trigger.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    const before = new URL(page.url()).pathname;
    const links = dialog.locator('a[href]');
    const count = await links.count();

    // A link that leads somewhere else — the brand points at the page we are
    // already on, and clicking it would prove nothing about navigation.
    let clicked: string | undefined;
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      if (!href || href.startsWith('http')) continue;
      if (href === '/' || samePath(href, before)) continue;

      await links.nth(i).click();
      clicked = href;
      break;
    }

    // `if (count > 0)` used to wrap everything below: an empty panel, or one
    // with nothing but the brand, passed this test without asserting anything.
    expect(
      clicked,
      `the mobile panel had no link away from ${before}`,
    ).toBeDefined();

    await page
      .waitForURL((url) => !samePath(new URL(url).pathname, before), {
        timeout: 15000,
      })
      .catch(() => {});

    expect(
      samePath(new URL(page.url()).pathname, before),
      `clicking "${clicked}" should have navigated away from ${before}`,
    ).toBe(false);

    // Dialog should close after navigation
    await expect(dialog).toBeHidden({ timeout: 10000 });
  });

  test('should have search accessible on mobile', async ({ page }) => {
    await setMobileViewport(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await waitForHydration(page);

    const searchButton = page.locator('[data-slot="search-button"]');
    await expect(searchButton).toBeVisible({ timeout: 15000 });
  });
});
