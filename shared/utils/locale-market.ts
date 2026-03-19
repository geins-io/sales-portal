/**
 * Shared locale/market prefix utilities.
 *
 * Works in both server (Node) and client (browser) contexts.
 * Single source of truth for detecting and stripping the leading
 * /{market}/{locale} prefix from URL paths.
 */

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
