/**
 * Shared locale/market prefix utilities.
 *
 * Works in both server (Node) and client (browser) contexts.
 * Single source of truth for detecting and stripping the leading
 * /{market}/{locale} prefix from URL paths.
 */

// ---------------------------------------------------------------------------
// Resolved locale/market — validated, expanded, single source of truth
// ---------------------------------------------------------------------------

/**
 * Validated locale/market data with BCP-47 expansion.
 * Set on `event.context.resolvedLocaleMarket` by the tenant context plugin.
 */
export interface ResolvedLocaleMarket {
  /** Validated short market code, e.g. 'se' */
  market: string;
  /** Validated short locale code, e.g. 'sv' */
  locale: string;
  /** Expanded BCP-47 locale, e.g. 'sv-SE' */
  localeBcp47: string;
}

/**
 * Extracts 2-letter locale codes from full BCP-47 locale strings.
 *
 * @example
 * extractShortLocales(['sv-SE', 'en-US']) // Set(['sv', 'en'])
 * extractShortLocales([])                 // Set()
 */
export function extractShortLocales(fullLocales: string[]): Set<string> {
  const shorts = new Set<string>();
  for (const l of fullLocales) {
    const short = l.split('-')[0];
    if (short && /^[a-z]{2}$/.test(short)) {
      shorts.add(short);
    }
  }
  return shorts;
}

/**
 * Validates parsed locale/market values against tenant configuration.
 * Returns a resolved result with BCP-47 expansion and whether correction was needed.
 *
 * Pure function — no side effects, no cookies, no redirects.
 */
export function resolveLocaleMarket(
  parsed: { market: string; locale: string },
  tenantLocaleConfig: {
    availableLocales: string[];
    availableMarkets: string[];
    defaultLocale: string;
    defaultMarket: string;
  },
): { resolved: ResolvedLocaleMarket; corrected: boolean } {
  const { availableLocales, availableMarkets, defaultLocale, defaultMarket } =
    tenantLocaleConfig;

  const validLocales = extractShortLocales(availableLocales);
  const validMarkets = new Set(availableMarkets);

  const marketValid = validMarkets.has(parsed.market);
  const localeValid = validLocales.has(parsed.locale);

  const corrected = !marketValid || !localeValid;

  const resolvedMarket = marketValid ? parsed.market : defaultMarket;
  const resolvedLocale = localeValid
    ? parsed.locale
    : (defaultLocale.split('-')[0] ?? defaultLocale);

  // Expand short locale to BCP-47 by finding the match in availableLocales
  let localeBcp47 = defaultLocale;
  if (localeValid) {
    const match = availableLocales.find(
      (l) => l.split('-')[0] === parsed.locale,
    );
    if (match) {
      localeBcp47 = match;
    }
  }

  return {
    resolved: {
      market: resolvedMarket,
      locale: resolvedLocale,
      localeBcp47,
    },
    corrected,
  };
}

// ---------------------------------------------------------------------------
// Supported locales — single source of truth
// ---------------------------------------------------------------------------

/**
 * All locale codes the app supports. Add new locales here — the type
 * and nuxt.config i18n locales array both derive from this.
 */
export const SUPPORTED_LOCALE_CODES = ['en', 'sv'] as const;

/** Union type of supported locale codes. */
export type SupportedLocale = (typeof SUPPORTED_LOCALE_CODES)[number];

/**
 * Check whether a path starts with two 2-letter segments (market + locale).
 *
 * @example
 * hasLocaleMarketPrefix('/se/sv/foder')  // true
 * hasLocaleMarketPrefix('/foder')        // false
 * hasLocaleMarketPrefix('/')             // false
 */
export function hasLocaleMarketPrefix(path: string): boolean {
  const segments = path.split('/').filter(Boolean);
  return (
    segments.length >= 2 &&
    /^[a-z]{2}$/.test(segments[0]!) &&
    /^[a-z]{2}$/.test(segments[1]!)
  );
}

/**
 * Strip leading 2-letter locale/market prefix segments from a path.
 *
 * The server middleware rewrites `/se/sv/foder` to `/foder` before SSR,
 * but on client-side navigation Vue Router sees the full URL. This function
 * ensures both sides produce the same canonical path for cache keys and
 * API queries, preventing hydration mismatches and duplicate cache entries.
 *
 * @example
 * stripLocaleMarketPrefix('/se/sv/foder') // '/foder'
 * stripLocaleMarketPrefix('/se/sv/')      // '/'
 * stripLocaleMarketPrefix('/foder')        // '/foder'
 * stripLocaleMarketPrefix('/')             // '/'
 */
export function stripLocaleMarketPrefix(path: string): string {
  const segments = path.split('/').filter(Boolean);

  if (
    segments.length >= 2 &&
    /^[a-z]{2}$/.test(segments[0]!) &&
    /^[a-z]{2}$/.test(segments[1]!)
  ) {
    const rest = segments.slice(2);
    return rest.length > 0 ? `/${rest.join('/')}` : '/';
  }

  return path;
}

/**
 * Normalize a route parameter (slug) into a consistent path format.
 *
 * @param slug - The slug parameter from the route (string, string[], or undefined)
 * @returns A normalized path string with leading slash and no trailing slash
 *
 * @example
 * normalizeSlugToPath(['category', 'product']) // '/category/product'
 * normalizeSlugToPath('category') // '/category'
 * normalizeSlugToPath([]) // '/'
 * normalizeSlugToPath(undefined) // '/'
 */
export function normalizeSlugToPath(
  slug: string | string[] | undefined,
): string {
  const parts = Array.isArray(slug) ? slug : slug ? [slug] : [];
  const clean = parts.filter((p) => typeof p === 'string' && p.length > 0);

  if (clean.length === 0) return '/';

  return `/${clean.join('/')}`;
}
