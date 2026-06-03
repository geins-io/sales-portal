import { test, expect, type Page } from '@playwright/test';

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

      let cssRuleCount = -1;
      try {
        cssRuleCount = styleEl?.sheet?.cssRules.length ?? -1;
      } catch {
        cssRuleCount = -1;
      }

      // Is the bundled utility stylesheet (which carries the .bg-* rules)
      // actually applied? Under a local http preview, the production CSP's
      // upgrade-insecure-requests rewrites the external <link> to https and it
      // fails to load — a test-environment artifact, not the bug. The painted
      // check below is gated on this so it only runs when it can be trusted.
      let bundledCssLoaded = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (
              rule instanceof CSSStyleRule &&
              rule.selectorText?.includes('.bg-top-bar-background')
            ) {
              bundledCssLoaded = true;
              break;
            }
          }
        } catch {
          // cross-origin / blocked sheet — ignore
        }
        if (bundledCssLoaded) break;
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
        bundledCssLoaded,
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
      test.info().annotations.push({
        type: 'note',
        description: 'CSP inactive (dev server) — nonce checks skipped',
      });
    }

    // --- End-to-end painted check (only when bundled utility CSS loaded) ---
    // Skipped under a local http preview where upgrade-insecure-requests blocks
    // the external stylesheet; CI (https) and `pnpm dev` both exercise it.
    if (state.bundledCssLoaded) {
      expect(
        TRANSPARENT.has(state.topBarBg ?? ''),
        `topbar must paint a real background, got "${state.topBarBg}"`,
      ).toBe(false);
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'bundled utility CSS not applied (local http upgrade artifact) — painted check skipped',
      });
    }
  });
});
