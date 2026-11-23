import { test, expect, type Page } from './fixtures';
import {
  discoverPurchasableProduct,
  hasE2ECredentials,
  noteOutOfScope,
  outOfScope,
  signedInState,
  waitForHydration,
} from './helpers';
import { apiGet } from './api-call';

/**
 * Tenant theme color application — Safari/WebKit regression guard.
 *
 * The tenant theme (topbar background, button colors, footer, ...) is injected
 * as an inline `<style data-tenant-theme>` block by server/plugins/04.tenant-css.ts.
 * Those surface CSS variables have NO :root fallback in the bundled stylesheet,
 * so if that inline block is rejected the topbar and buttons render with no
 * background at all.
 *
 * Under the production Content-Security-Policy (style-src has a nonce but no
 * 'unsafe-inline'), the block survives only if it carries exactly one valid
 * nonce. A regression that emits a duplicate nonce attribute is tolerated by
 * Chromium but rejected by WebKit/Safari, which is invisible to a Chromium-only
 * test suite. This spec therefore runs under the `webkit` project against a
 * production build and asserts the tenant style is actually applied.
 *
 * The CSP-specific assertions only fire when a CSP is present (production /
 * `pnpm preview`); against `pnpm dev` (CSP disabled) the positive color checks
 * still run. To reproduce the production path locally:
 *
 *   E2E_PROD=1 pnpm test:e2e --project=webkit theme-colors
 *
 * WebKit needs libwoff1 on the host (`sudo npx playwright install-deps webkit`).
 */

/** Surface vars that exist ONLY in the injected tenant block (no :root fallback). */
const SURFACE_VARS = ['--top-bar-background', '--button-background'] as const;

const TRANSPARENT = new Set(['rgba(0, 0, 0, 0)', 'transparent', '']);

async function collectThemeState(page: Page) {
  return page.evaluate(
    (surfaceVars) => {
      const styleEl = document.querySelector<HTMLStyleElement>(
        'style[data-tenant-theme]',
      );
      const root = document.documentElement;
      const cssVar = (name: string) =>
        getComputedStyle(root).getPropertyValue(name).trim();

      let cssRuleCount: number;
      try {
        cssRuleCount = styleEl?.sheet?.cssRules.length ?? -1;
      } catch {
        cssRuleCount = -1;
      }

      const topBarEl = document.querySelector('.bg-top-bar-background');

      return {
        present: !!styleEl,
        // outerHTML reflects the parsed DOM; a duplicate-attribute parse error
        // collapses to one, so this counts the surviving attributes only. The
        // real duplicate guard is the absence of a style-src violation below.
        nonceAttrCount: styleEl
          ? (styleEl.outerHTML.match(/\bnonce=/gi) ?? []).length
          : 0,
        cssRuleCount,
        surfaceValues: Object.fromEntries(
          surfaceVars.map((v) => [v, cssVar(v)]),
        ) as Record<string, string>,
        topBarBg: topBarEl ? getComputedStyle(topBarEl).backgroundColor : null,
      };
    },
    SURFACE_VARS as unknown as string[],
  );
}

test.describe('Tenant theme colors apply in WebKit', () => {
  test('injected tenant style is applied and surface colors resolve', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cspViolations: string[] }).__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        (
          window as unknown as { __cspViolations: string[] }
        ).__cspViolations.push(`${e.violatedDirective}|${e.blockedURI}`);
      });
    });

    const response = await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');

    const csp = response?.headers()['content-security-policy'] ?? '';
    const cspActive = csp.includes('style-src');

    const state = await collectThemeState(page);

    // --- Proximate-cause checks (independent of the external bundled CSS) ---
    // These distinguish the WebKit bug from a healthy render regardless of
    // http/https: the tenant block must be parsed and its surface vars must
    // resolve to a real color. When WebKit rejects the block under CSP, the
    // sheet has zero rules and the vars resolve to "".
    expect(state.present, 'tenant theme <style> must be in the DOM').toBe(true);
    expect(
      state.cssRuleCount,
      'tenant theme stylesheet must be applied (cssRules parsed)',
    ).toBeGreaterThan(0);

    for (const v of SURFACE_VARS) {
      expect(
        state.surfaceValues[v],
        `${v} must resolve to a color (only the tenant block defines it)`,
      ).toMatch(/^(#|rgb|hsl|oklch)/i);
    }

    // --- CSP-specific checks (production / preview only) ---
    if (cspActive) {
      const styleViolations = await page.evaluate(() =>
        (
          window as unknown as { __cspViolations: string[] }
        ).__cspViolations.filter((v) => v.startsWith('style-src')),
      );
      expect(
        styleViolations,
        'no style-src violation — a duplicate nonce attribute trips this in WebKit',
      ).toEqual([]);

      expect(
        state.nonceAttrCount,
        'tenant <style> must carry exactly one nonce under CSP',
      ).toBe(1);
    } else {
      noteOutOfScope('dev-server', 'CSP inactive — nonce checks not asserted');
    }

    // --- End-to-end painted check ---
    // The bundled utility stylesheet carries the .bg-* rules. It loads under
    // every run mode: the production build is served over https under test
    // (see playwright.config.ts), so upgrade-insecure-requests no longer
    // rewrites the external <link> to an address nothing answers on.
    expect(
      TRANSPARENT.has(state.topBarBg ?? ''),
      `topbar must paint a real background, got "${state.topBarBg}"`,
    ).toBe(false);
  });
});

/** Distinct from each other and from any tenant's primary foreground. */
const SIMULATED = {
  '--button-text': 'rgb(1 2 3)',
  '--button-purchase-text': 'rgb(4 5 6)',
} as const;

/**
 * Sets both button text variables on <html>, which outranks the tenant block,
 * then reads the first visible match's text colour, the colour it should have
 * and the primary foreground it used to have. All three come back as painted
 * RGBA bytes, because a computed colour and a custom property value can be
 * written in different notations for the same colour.
 */
async function paintedText(
  page: Page,
  selector: string,
  variable: keyof typeof SIMULATED,
) {
  await expect(page.locator(`${selector}:visible`).first()).toBeVisible();
  return page.evaluate(
    ({ selector, variable, simulated }) => {
      const el = Array.from(
        document.querySelectorAll<HTMLElement>(selector),
      ).find((e) => e.offsetParent !== null);
      // Buttons transition their colours; mid-transition the computed colour
      // is still the old one.
      if (el) el.style.transition = 'none';
      const root = document.documentElement;
      for (const [name, value] of Object.entries(simulated)) {
        root.style.setProperty(name, value);
      }
      const ctx = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no 2d canvas');
      const toRgba = (css: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data).join(',');
      };
      return {
        painted: el ? toRgba(getComputedStyle(el).color) : 'none',
        expected: toRgba(simulated[variable]),
        primaryForeground: toRgba(
          getComputedStyle(root).getPropertyValue('--primary-foreground'),
        ),
      };
    },
    { selector, variable, simulated: SIMULATED },
  );
}

/**
 * Each button variant paints its text from its own variable. The values are
 * simulated in the page, so the assertion cannot pass on a tenant whose button
 * text happens to equal its primary foreground; that the admin value reaches
 * the variable is the unit tests' job.
 */
test.describe('Tenant button text colours', () => {
  outOfScope(
    !hasE2ECredentials(),
    'no-credentials',
    'the purchase button needs an authenticated customer (set E2E_USERNAME / E2E_PASSWORD in .env)',
  );

  // The purchase button renders only for a session with order access.
  test.use({ storageState: signedInState });

  test('both button variants paint their text from their own variable (simulated values)', async ({
    page,
  }) => {
    const config = (await (
      await apiGet(page.request, '/api/config')
    ).json()) as {
      theme: { colors: Record<string, string | null | undefined> };
    };
    expect(
      config.theme.colors.buttonText,
      '/api/config buttonText',
    ).toBeTruthy();
    expect(
      config.theme.colors.buttonPurchaseText,
      '/api/config buttonPurchaseText',
    ).toBeTruthy();

    // The empty cart's call to action wears the general button colours; a
    // fresh context from the stored login carries no cart.
    await page.goto('/cart');
    // Leaving a page mid-hydration makes Nuxt reload it over the next goto.
    await waitForHydration(page);
    const general = await paintedText(
      page,
      '.bg-button-background',
      '--button-text',
    );

    // ProductCard's default-variant button shares the test id.
    const product = await discoverPurchasableProduct(page);
    await page.goto(`/p/${product.alias}`);
    const purchase = await paintedText(
      page,
      '.bg-button-purchase-background[data-testid="add-to-cart-button"]',
      '--button-purchase-text',
    );

    for (const [name, result] of [
      ['general', general],
      ['purchase', purchase],
    ] as const) {
      expect(
        result.primaryForeground,
        `${name}: the simulated value must differ from the primary foreground`,
      ).not.toBe(result.expected);
      expect(result.painted, `${name} button text`).toBe(result.expected);
    }
  });
});

/**
 * The nav bar's custom colours and alignment arrive from the tenant theme as
 * variables. The values are simulated on the bar, so the assertions hold
 * whatever the tenant has chosen; that the Studio values reach the variables
 * is the unit tests' job.
 */
test.describe('Tenant nav bar colour and alignment', () => {
  // The outer <nav>; the menu root inside it is a <nav> too.
  const BAR = 'nav.bg-nav-bar-background';
  const WHITE = 'rgb(255, 255, 255)';

  test.beforeEach(({ isMobile }) => {
    outOfScope(isMobile, 'mobile-project', 'the nav bar is desktop only');
  });

  async function openBar(page: Page, vars: Record<string, string>) {
    await page.goto('/');
    await waitForHydration(page);
    const bar = page.locator(BAR);
    await expect(bar).toBeVisible();
    await bar.evaluate((el, values) => {
      for (const [name, value] of Object.entries(values)) {
        (el as HTMLElement).style.setProperty(name, value);
      }
    }, vars);
    return bar;
  }

  test('a custom bar paints its labels in its own text colour at rest, hovered and open, and leaves the dropdown alone (simulated values)', async ({
    page,
  }) => {
    const bar = await openBar(page, {
      '--nav-bar-background': 'rgb(54, 54, 54)',
      '--nav-bar-text': WHITE,
    });
    await expect(bar).toHaveCSS('background-color', 'rgb(54, 54, 54)');

    // Only the top-level links: the dropdown's links share the slot.
    const plain = bar
      .locator(
        '[data-slot="navigation-menu-item"] > [data-slot="navigation-menu-link"]',
      )
      .first();
    if ((await plain.count()) === 0) {
      // Still runs the trigger half below.
      noteOutOfScope(
        'tenant-config',
        'the header menu has no item without children',
      );
    } else {
      await expect(plain).toHaveCSS('color', WHITE);
      await plain.hover();
      await expect(plain).toHaveCSS('color', WHITE);
    }

    const trigger = bar
      .locator('[data-slot="navigation-menu-trigger"]')
      .first();
    outOfScope(
      (await trigger.count()) === 0,
      'tenant-config',
      'the header menu has no item with children',
    );
    await expect(trigger).toHaveCSS('color', WHITE);
    await trigger.hover();
    await expect(trigger).toHaveAttribute('data-state', 'open');
    await expect(trigger).toHaveCSS('color', WHITE);

    const panel = bar.locator('[data-slot="navigation-menu-content"]').first();
    await expect(panel).toBeVisible();
    const panelColor = await panel.evaluate((el) => getComputedStyle(el).color);
    expect(panelColor, 'the dropdown keeps the popover text').not.toBe(WHITE);
    await expect(panel.locator('a').first()).toHaveCSS('color', panelColor);
  });

  // The saved alignment, read as buildTenantConfig reads it: the catalogue is
  // always at the start, whatever alignment is saved.
  test('items sit where the saved nav bar alignment puts them', async ({
    page,
  }) => {
    const config = await apiGet(page.request, '/api/config');
    expect(config.ok(), '/api/config did not answer 200').toBe(true);
    const menu = (await config.json())?.layout?.menu as
      | { type?: string | null; navbarAlignment?: string | null }
      | null
      | undefined;
    const centred =
      menu?.type !== 'catalogue' && menu?.navbarAlignment === 'center';

    const bar = await openBar(page, {});
    const geometry = await bar.evaluate((el) => {
      const list = el.querySelector<HTMLElement>(
        '[data-slot="navigation-menu-list"]',
      )!;
      const style = getComputedStyle(list);
      const box = list.getBoundingClientRect();
      const left = box.left + parseFloat(style.paddingLeft);
      const right = box.right - parseFloat(style.paddingRight);
      const items = Array.from(list.children, (i) => i.getBoundingClientRect());
      return {
        before: items[0]!.left - left,
        after: right - items[items.length - 1]!.right,
        overflowing: list.scrollWidth > list.clientWidth,
      };
    });

    if (centred && !geometry.overflowing) {
      expect(
        geometry.before,
        'the items are centred, not at the start',
      ).toBeGreaterThan(1);
      expect(Math.abs(geometry.before - geometry.after)).toBeLessThanOrEqual(2);
    } else {
      // Left, absent, the catalogue, or centred items that do not fit.
      expect(Math.abs(geometry.before)).toBeLessThanOrEqual(1);
    }
  });

  test('centred items sit in the middle of the bar when they fit (simulated value)', async ({
    page,
  }) => {
    const bar = await openBar(page, { '--nav-bar-justify': 'safe center' });
    // Three items fit any desktop bar, whatever the tenant's menu holds.
    const geometry = await bar.evaluate((el) => {
      const list = el.querySelector<HTMLElement>(
        '[data-slot="navigation-menu-list"]',
      )!;
      const items = Array.from(list.children) as HTMLElement[];
      items.slice(3).forEach((item) => (item.style.display = 'none'));
      const style = getComputedStyle(list);
      const box = list.getBoundingClientRect();
      const left = box.left + parseFloat(style.paddingLeft);
      const right = box.right - parseFloat(style.paddingRight);
      const shown = items.slice(0, 3).map((i) => i.getBoundingClientRect());
      return {
        before: shown[0]!.left - left,
        after: right - shown[shown.length - 1]!.right,
        overflowing: list.scrollWidth > list.clientWidth,
      };
    });
    expect(geometry.overflowing, 'three items must fit').toBe(false);
    expect(
      geometry.before,
      'the items are centred, not at the start',
    ).toBeGreaterThan(20);
    expect(Math.abs(geometry.before - geometry.after)).toBeLessThanOrEqual(2);
  });

  test('centred items that do not fit start at the edge, so none are cut off (simulated value)', async ({
    page,
  }) => {
    const bar = await openBar(page, { '--nav-bar-justify': 'safe center' });
    const geometry = await bar.evaluate((el) => {
      const list = el.querySelector<HTMLElement>(
        '[data-slot="navigation-menu-list"]',
      )!;
      // A gap wider than the bar makes any menu of two items overflow.
      list.style.gap = '1400px';
      const style = getComputedStyle(list);
      const left =
        list.getBoundingClientRect().left + parseFloat(style.paddingLeft);
      const first = (
        list.firstElementChild as HTMLElement
      ).getBoundingClientRect();
      return {
        offset: first.left - left,
        scrollLeft: list.scrollLeft,
        overflowing: list.scrollWidth > list.clientWidth,
      };
    });
    expect(geometry.overflowing, 'the items must overflow').toBe(true);
    expect(geometry.scrollLeft).toBe(0);
    expect(
      geometry.offset,
      'the first item starts at the edge, inside scroll reach',
    ).toBeGreaterThanOrEqual(-1);
    expect(geometry.offset).toBeLessThanOrEqual(1);
  });
});
