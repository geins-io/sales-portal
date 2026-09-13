import { test, expect, type APIRequestContext } from '@playwright/test';
import { waitForHydration } from './helpers';

/**
 * Basic Application E2E Tests
 *
 * Tests that verify the application loads correctly and basic navigation works.
 */

/** The fields of `/api/config` the title is built from. */
interface TenantConfigTitle {
  tenantId: string;
  branding?: { name?: string };
  seo?: { defaultTitle?: string };
}

/**
 * The title the app resolves for a page that sets none of its own — the same
 * order `app/plugins/tenant-seo.ts` resolves it in. Read from the tenant that
 * answered rather than hardcoded, so the assertion travels to the next tenant
 * instead of being weakened back to a match-anything regex the first time one
 * differs.
 */
async function expectedDefaultTitle(
  request: APIRequestContext,
): Promise<string> {
  const config = (await (await request.get('/api/config')).json()) as
    | TenantConfigTitle
    | undefined;
  return (
    config?.seo?.defaultTitle ||
    config?.branding?.name ||
    config?.tenantId ||
    ''
  );
}

test.describe('Application', () => {
  test('should load the home page', async ({ page }) => {
    const title = await expectedDefaultTitle(page.request);
    expect(title, '/api/config carries no name to build a title from').not.toBe(
      '',
    );

    await page.goto('/');

    // The home page sets no title of its own, so it renders the tenant default
    // verbatim. Every other page wraps its own through `%s - {brand}`, the
    // error page included, so a wrong page fails here rather than passing on
    // a regex that matches every string.
    await expect(page).toHaveTitle(title);
  });

  test('should not have any console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected warnings/errors (e.g., 404s for missing resources in dev)
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('404') &&
        !error.includes('Failed to load resource') &&
        !error.includes('Cross-Origin-Opener-Policy') &&
        !error.includes('Content Security Policy'),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Navigation', () => {
  test('should have navigable links in the header', async ({ page }) => {
    await page.goto('/');

    // The header should contain at least one link
    const headerLinks = page.locator('header a[href]');
    const count = await headerLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

/**
 * The home page has one breakpoint of its own: `lg`, 1024px. The two header
 * buttons are `lg:hidden` and the inline search bar's wrapper is
 * `hidden … lg:flex`, so that is the only width where the header changes
 * shape. None of the three is behind a `v-if`, so a tenant that configures
 * its header differently cannot make the assertion vacuous.
 */
const LG_BREAKPOINT = 1024;

const VIEWPORTS = [
  { label: 'mobile', width: 375, height: 667 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1440, height: 900 },
] as const;

test.describe('Responsive Design', () => {
  for (const viewport of VIEWPORTS) {
    test(`should render correctly on ${viewport.label} viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto('/');

      // Before the stylesheet applies, a viewport-gated element reads as
      // visible (docs/testing.md) — which is the one distinction this test
      // exists to make.
      await waitForHydration(page);

      // The header shape this width calls for. Below `lg` the page is
      // navigated and searched from the two icon buttons; at and above it,
      // from the inline search bar and the nav row.
      const wide = viewport.width >= LG_BREAKPOINT;
      await expect(
        page.locator('[data-testid="mobile-nav-trigger"]'),
        `${viewport.width}px: the hamburger belongs below lg only`,
      ).toBeVisible({ visible: !wide });
      await expect(
        page.locator('[data-testid="mobile-search-trigger"]'),
        `${viewport.width}px: the search icon belongs below lg only`,
      ).toBeVisible({ visible: !wide });
      await expect(
        page.locator('[data-testid="search-input"]'),
        `${viewport.width}px: the inline search bar belongs at lg and above`,
      ).toBeVisible({ visible: wide });

      // And the layout fits the width rather than merely rendering in it.
      const overhang = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(
        overhang,
        `${viewport.width}px: the page scrolls sideways by ${overhang}px`,
      ).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');

    // Page should have at least one heading element
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have lang attribute on html element', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    // Lang is set dynamically from tenant locale (e.g. 'sv-SE', 'en')
    await expect(html).toHaveAttribute('lang', /^[a-z]{2}(-[A-Z]{2})?$/);
  });

  test('should have proper meta viewport', async ({ page }) => {
    await page.goto('/');

    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds (generous for CI)
    expect(loadTime).toBeLessThan(10000);
  });
});
