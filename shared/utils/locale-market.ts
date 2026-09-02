/**
 * Locale/market prefix utilities, shared by server and browser. Pure functions
 * only — no cookies, no redirects, no side effects.
 */

/** Set on `event.context.resolvedLocaleMarket` by `server/middleware/00.locale-market.ts`. */
export interface ResolvedLocaleMarket {
  /** Short code, e.g. 'se'. */
  market: string;
  /** Short code, e.g. 'sv'. */
  locale: string;
  /** BCP-47, e.g. 'sv-SE'. */
  localeBcp47: string;
}

/** The shape of both URL prefix segments. */
const TWO_LETTER_CODE = /^[a-z]{2}$/;

/** `['sv-SE', 'en-US']` -> `Set(['sv', 'en'])`. */
export function extractShortLocales(fullLocales: string[]): Set<string> {
  const shorts = new Set<string>();
  for (const l of fullLocales) {
    const short = l.split('-')[0];
    if (short && TWO_LETTER_CODE.test(short)) {
      shorts.add(short);
    }
  }
  return shorts;
}

/**
 * Validates a pair against tenant config, expanding the locale to BCP-47.
 *
 * A locale must clear both gates — the tenant sells it AND this build ships
 * messages for it — or the page renders raw translation keys. Markets are
 * tenant data all the way down, so their list is the only gate.
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
  const shippedLocales = new Set<string>(SUPPORTED_LOCALE_CODES);

  const marketValid = validMarkets.has(parsed.market);
  const localeValid =
    validLocales.has(parsed.locale) && shippedLocales.has(parsed.locale);

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

/** The codes a tenant can serve: sold by the tenant AND shipped by this build. */
export function resolvableLocaleCodes(availableLocales: string[]): string[] {
  const shipped = new Set<string>(SUPPORTED_LOCALE_CODES);
  return [...extractShortLocales(availableLocales)].filter((code) =>
    shipped.has(code),
  );
}

export interface PrefixInterpretation {
  /** Null when the slot was absent or unrecognised. */
  market: string | null;
  /** Null when the slot was absent or unrecognised. */
  locale: string | null;
  /** What is left after the prefix window. */
  content: string[];
  /**
   * A leading segment was consumed as a prefix attempt, valid or not — the
   * difference between a URL that got its prefix wrong and one that never had
   * a prefix to get wrong.
   */
  attemptedPrefix: boolean;
}

/**
 * Read the leading segments as a `/{market}/{locale}` prefix, greedily, against
 * the tenant's own lists.
 *
 * Inside the two-segment window a two-letter segment is ALWAYS a prefix
 * attempt, even when it matches nothing: no content lives directly under
 * `/{market}/`, so a bare code there cannot be a slug. Anything else is
 * content, unless a real locale follows it — then it was a botched market.
 *
 * @example
 * // markets ['se'], locales ['sv','en']; 'xx'/'zz' are never real codes
 * ['se', 'xx']        // market 'se', locale null,  content []
 * ['xx', 'en']        // market null, locale 'en',  content []
 * ['hejhej', 'blaha'] // market null, locale null,  content both
 * ['se', 'xxx']       // market 'se', locale null,  content ['xxx']
 */
export function interpretLocaleMarketPrefix(
  segments: string[],
  known: { markets: readonly string[]; locales: readonly string[] },
): PrefixInterpretation {
  const markets = new Set(known.markets);
  const locales = new Set(known.locales);

  const first = segments[0];
  const second = segments[1];

  let market: string | null = null;
  let locale: string | null = null;
  let index = 0;

  if (first !== undefined) {
    if (markets.has(first)) {
      market = first;
      index = 1;
    } else if (TWO_LETTER_CODE.test(first)) {
      index = 1;
    } else if (second !== undefined && locales.has(second)) {
      // A real locale follows, so this was a botched market, not content.
      index = 1;
    }
  }

  if (index === 1 && second !== undefined) {
    if (locales.has(second)) {
      locale = second;
      index = 2;
    } else if (TWO_LETTER_CODE.test(second)) {
      index = 2;
    }
  }

  return {
    market,
    locale,
    content: segments.slice(index),
    attemptedPrefix: index > 0,
  };
}

/**
 * Source of the `SupportedLocale` type. The nuxt.config i18n `locales` array is
 * maintained by hand alongside it — adding a locale means editing both, and
 * `tests/unit/nuxt-config-locales.test.ts` asserts they stay in step.
 */
export const SUPPORTED_LOCALE_CODES = ['en', 'sv', 'nb', 'fi', 'da'] as const;

/** Union type of supported locale codes. */
export type SupportedLocale = (typeof SUPPORTED_LOCALE_CODES)[number];

/**
 * `/se/en/c/one` -> `{ market: 'se', locale: 'en' }`; null when there is no
 * such prefix. Query and hash are ignored.
 *
 * Codes are NOT validated against any tenant — pass the result to
 * resolveLocaleMarket for that.
 */
export function parseLocaleMarketPrefix(
  path: string,
): { market: string; locale: string } | null {
  const cleanPath = path.split('?')[0]!.split('#')[0]!;
  const segments = cleanPath.split('/').filter(Boolean);
  if (
    segments.length >= 2 &&
    /^[a-z]{2}$/.test(segments[0]!) &&
    /^[a-z]{2}$/.test(segments[1]!)
  ) {
    return { market: segments[0]!, locale: segments[1]! };
  }
  return null;
}

/** Whether a path starts with two 2-letter segments. */
export function hasLocaleMarketPrefix(path: string): boolean {
  return parseLocaleMarketPrefix(path) !== null;
}

/**
 * `/se/sv/foder` -> `/foder`; a path without a prefix is returned unchanged.
 *
 * SSR sees the rewritten path but client navigation sees the full URL, so both
 * sides must derive the same cache key or they produce hydration mismatches
 * and duplicate cache entries.
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
 * `swapMarketInPath('/se/sv/portal', 'fi')` -> `/fi/sv/portal`; locale and tail
 * are preserved, trailing slash included.
 *
 * Used when login resolves a buyer-specific market that differs from the URL
 * the form came from, so SSR re-runs with the matching catalog and currency.
 */
export function swapMarketInPath(pathname: string, newMarket: string): string {
  const hasTrailingSlash = pathname.endsWith('/');
  const segments = pathname.split('/').filter(Boolean);
  const locale = segments[1] ?? 'sv';
  const rest = segments.slice(2).join('/');
  if (!rest) {
    return `/${newMarket}/${locale}${hasTrailingSlash ? '/' : ''}`;
  }
  return `/${newMarket}/${locale}/${rest}${hasTrailingSlash ? '/' : ''}`;
}

/** `['category', 'product']` -> `/category/product`; empty or missing -> `/`. */
export function normalizeSlugToPath(
  slug: string | string[] | undefined,
): string {
  const parts = Array.isArray(slug) ? slug : slug ? [slug] : [];
  const clean = parts.filter((p) => typeof p === 'string' && p.length > 0);

  if (clean.length === 0) return '/';

  return `/${clean.join('/')}`;
}
