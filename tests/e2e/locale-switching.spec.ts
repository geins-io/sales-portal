/**
 * Locale switching E2E Tests
 *
 * Drives the LocaleSwitcher into every language the app ships and asserts the
 * switch actually took effect three independent ways: the URL prefix, the
 * `<html lang>` attribute, and one real translated string on the page.
 *
 * Why the string assertion matters: key parity (tests/unit/i18n-locale-parity)
 * proves every locale file has every key, and the fallback-policy unit tests
 * prove which locale is chosen. Neither notices a locale file that still holds
 * English placeholder copy, nor a switch that changes the URL but leaves the
 * previous language rendered. Asserting the PER-LANGUAGE expected text closes
 * both gaps — a file reverted to English fails here, naming the locale.
 *
 * No hardcoded language list. The locales come from `nuxt.config.ts`'s i18n
 * block (the single source that also drives the app), their expected copy comes
 * from the matching `app/locales/*.json`, and the set is intersected at runtime
 * with the tenant's own `availableLocales` from `/api/config` — the switcher
 * only renders what the tenant offers. Add a language to nuxt.config and it is
 * covered here automatically.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { outOfScope, waitForHydration } from './helpers';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

/** The i18n key whose value is asserted per language. */
const PROBE_KEY = 'nav.search_products';

interface LocaleUnderTest {
  /** Short URL code, e.g. 'nb'. */
  code: string;
  /** BCP-47 tag the app puts in `<html lang>`, e.g. 'nb-NO'. */
  language: string;
  /** Expected rendered text for PROBE_KEY in this language. */
  probeText: string;
}

/**
 * Parse the i18n locales out of nuxt.config.ts.
 *
 * The config cannot be imported here: `defineNuxtConfig` is a Nuxt
 * auto-import that does not exist in Playwright's plain Node context. Reading
 * the literal keeps nuxt.config the single source anyway — a new entry there
 * is picked up on the next run, and a malformed/missing block throws below
 * rather than silently testing nothing.
 */
function readConfiguredLocales(): Array<{
  code: string;
  language: string;
  file: string;
}> {
  const source = readFileSync(resolve(REPO_ROOT, 'nuxt.config.ts'), 'utf8');
  const entry =
    /\{\s*code:\s*'([^']+)',\s*language:\s*'([^']+)',\s*name:\s*'[^']*',\s*file:\s*'([^']+)'\s*\}/g;

  const locales = [...source.matchAll(entry)].map((m) => ({
    code: m[1]!,
    language: m[2]!,
    file: m[3]!,
  }));

  if (locales.length === 0) {
    throw new Error(
      'Could not parse any i18n locales out of nuxt.config.ts. The locales ' +
        'array shape changed — update the regex in this spec, do not delete ' +
        'the assertion.',
    );
  }
  return locales;
}

/** Resolve a dotted key against a locale JSON file. */
function readMessage(file: string, dottedKey: string): string {
  const json = JSON.parse(
    readFileSync(resolve(REPO_ROOT, 'app/locales', file), 'utf8'),
  );
  const value = dottedKey
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      json,
    );

  if (typeof value !== 'string' || !value) {
    throw new Error(`"${dottedKey}" missing or not a string in ${file}`);
  }
  return value;
}

/** Locales the app ships, with their expected probe copy. Built at load time. */
const CONFIGURED_LOCALES: LocaleUnderTest[] = readConfiguredLocales().map(
  (l) => ({
    code: l.code,
    language: l.language,
    probeText: readMessage(l.file, PROBE_KEY),
  }),
);

// Two locales sharing a probe string would let the wrong rendering pass, and
// the commonest way that happens is a locale file reverted to English. Catch
// it here — before any browser starts — and name the locales that collide.
const collisions = [
  ...Map.groupBy(CONFIGURED_LOCALES, (l) => l.probeText).entries(),
]
  .filter(([, group]) => group.length > 1)
  .map(
    ([text, group]) =>
      `${group.map((l) => l.code).join(' + ')} all render "${text}"`,
  );

if (collisions.length > 0) {
  throw new Error(
    `"${PROBE_KEY}" is not unique across locales: ${collisions.join('; ')}. ` +
      'Either those locale files are untranslated for this key, or the probe ' +
      'key is a poor choice — a shared value cannot prove a switch happened.',
  );
}

/** Full BCP-47 locale tags this tenant actually offers, from its own config. */
async function tenantAvailableLocales(page: Page): Promise<string[]> {
  const response = await page.request.get('/api/config');
  expect(response.ok(), 'GET /api/config must succeed').toBe(true);

  const config = await response.json();
  const available: unknown = config?.availableLocales;
  expect(
    Array.isArray(available) && available.length > 0,
    'tenant config must expose availableLocales',
  ).toBe(true);

  return available as string[];
}

/**
 * Every translation of `common.change_language` — the dropdown trigger's
 * aria-label. It is itself localised, and the page may be in any language when
 * we reach for it, so match against all of them rather than one hardcoded
 * string. Same source as everything else in this spec.
 */
const CHANGE_LANGUAGE_LABELS = readConfiguredLocales().map((l) =>
  readMessage(l.file, 'common.change_language'),
);

/**
 * Reveal the switcher entry for `code` and return it.
 *
 * The switcher has two variants: an inline row whose links are in the SSR
 * markup, and a dropdown whose links only exist once the trigger is clicked.
 * Handle both — use the link directly when it is already present, otherwise
 * open the dropdown.
 *
 * The trigger click is retried: hydration-mismatch patching can leave the
 * dropdown's handler briefly unattached, so the first click can land on a
 * control that is painted but not yet interactive. `addToCart` in ./helpers
 * carries the same retry for the same reason.
 */
async function revealLocaleLink(page: Page, code: string) {
  const link = page
    .locator(`[data-testid="locale-switcher-link"][data-locale="${code}"]`)
    .first();

  const trigger = page
    .locator(
      CHANGE_LANGUAGE_LABELS.map(
        (label) => `button[aria-label="${label}"]`,
      ).join(', '),
    )
    .first();

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await link.isVisible().catch(() => false)) return link;

    await expect(
      trigger,
      'neither the inline switcher links nor a change-language trigger were ' +
        `found (looked for aria-labels: ${CHANGE_LANGUAGE_LABELS.join(', ')})`,
    ).toBeVisible({ timeout: 10000 });

    await trigger.click();
    await link.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  }

  await expect(
    link,
    `no locale-switcher entry for "${code}" after 3 attempts — the tenant ` +
      'offers it but the switcher did not render it',
  ).toBeVisible({ timeout: 5000 });
  return link;
}

/** Open the switcher and click through to `code`. */
async function switchToLocale(page: Page, code: string): Promise<void> {
  const target = await revealLocaleLink(page, code);

  await Promise.all([
    page.waitForURL(new RegExp(`/se/${code}/`), { timeout: 20000 }),
    target.click(),
  ]);
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Locale switching', () => {
  test('the tenant offers more than one locale (switcher precondition)', async ({
    page,
  }) => {
    await page.goto('/');
    const codes = (await tenantAvailableLocales(page)).map(
      (l) => l.split('-')[0]!,
    );
    expect(
      codes.length,
      `tenant exposes only [${codes.join(', ')}] — the switcher hides itself ` +
        'below two locales, so every per-locale case below would skip',
    ).toBeGreaterThan(1);
  });

  for (const locale of CONFIGURED_LOCALES) {
    test(`switches into ${locale.code} (${locale.language}) and renders its own copy`, async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const tenantLocales = await tenantAvailableLocales(page);
      const tenantCodes = tenantLocales.map((l) => l.split('-')[0]!);
      outOfScope(
        !tenantCodes.includes(locale.code),
        'tenant-config',
        `tenant does not offer "${locale.code}" (has: ${tenantCodes.join(', ')})`,
      );

      await waitForHydration(page);
      await switchToLocale(page, locale.code);

      // 1. URL carries the locale prefix.
      expect(
        new URL(page.url()).pathname,
        `URL should sit under /se/${locale.code}/ after switching`,
      ).toMatch(new RegExp(`^/se/${locale.code}/`));

      // 2. <html lang> carries the tenant's own BCP-47 tag for this locale
      //    (the same 'en' can be en-GB on one tenant and en-US on another).
      //    Same prefix-match as app/utils/locale-bcp47.ts — not imported,
      //    e2e specs sit outside the Nuxt tsconfig projects.
      const expectedLang =
        tenantLocales.find((l) => l.split('-')[0] === locale.code) ??
        locale.language;
      await expect(
        page.locator('html'),
        `<html lang> should be "${expectedLang}" for locale "${locale.code}"`,
      ).toHaveAttribute('lang', expectedLang, { timeout: 10000 });

      // 3. A real translated string renders. Asserting the exact per-language
      //    value means an English placeholder cannot pass for a translation.
      //    The probe input is inline on desktop but behind the search overlay
      //    on mobile (its trigger is `lg:hidden`), so branch on the layout.
      // Tailwind's lg breakpoint; the mobile trigger is `lg:hidden`. Decided on
      // the viewport, not isVisible(): right after the reload the stylesheet
      // may not have applied yet and the hidden trigger reads as visible.
      const isMobile = (page.viewportSize()?.width ?? 1280) < 1024;
      const mobileTrigger = page.locator('[data-slot="search-button"]');
      let searchInput = page.locator('[data-testid="search-input"]').first();

      if (isMobile) {
        // Fresh page load after the switch — the overlay toggle only works
        // once hydrated.
        await waitForHydration(page);
        await mobileTrigger.click();
        searchInput = page.locator(
          '[data-testid="mobile-search-panel"] [data-testid="search-input"]',
        );
      }

      await expect(searchInput).toBeVisible({ timeout: 20000 });
      await expect(
        searchInput,
        `"${PROBE_KEY}" should render as the ${locale.code} translation ` +
          `("${locale.probeText}") — an untranslated file fails here`,
      ).toHaveAttribute('placeholder', locale.probeText, { timeout: 10000 });
    });
  }
});
