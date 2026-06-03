import { ROUTE_PATHS } from '../constants/route-paths';

/** Geins entity prefix tokens that appear in alternate URLs. */
const GEINS_ENTITY_PREFIXES = new Set(['p', 'c', 'b', 'l', 's', 'dc']);

/** Valid app route prefixes (no /l/: there is no app page for it). */
const APP_ROUTE_PREFIXES = new Set(['p', 'c', 'b', 's', 'dc']);

/**
 * Strip the Geins market/locale prefix from a canonical URL and prepend
 * a route-type prefix. The result is a locale-free path ready to be
 * wrapped by `localePath()`.
 *
 * The Geins API returns canonical URLs with market/locale but WITHOUT
 * type prefixes:
 *   /se/sv/material/epoxy          -> /c/material/epoxy
 *   /se/sv/material/epoxy/product  -> /p/material/epoxy/product
 *
 * If the URL has no locale/market prefix:
 *   /material/epoxy                -> /c/material/epoxy
 *
 * If the URL is a bare alias with no leading slash:
 *   manifold-x                     -> /p/manifold-x (when prefix is /p/)
 */
function buildTypePrefixedPath(canonicalUrl: string, prefix: string): string {
  // Tolerate bare aliases with no leading slash.
  const normalized = canonicalUrl.startsWith('/')
    ? canonicalUrl
    : `/${canonicalUrl}`;
  // Strip /{market}/{locale} prefix if present
  const match = normalized.match(/^\/[a-z]{2}\/[a-z]{2}(?:-[a-z]{2})?(\/.*)?$/);
  let slug = match ? match[1] || '/' : normalized;
  // Strip any existing type prefix the upstream may have included. Geins
  // returns canonical URLs like `/se/sv/p/category/product` for products and
  // `/se/sv/l/category` for category listings, so without this step we'd
  // emit `/p/p/category/product` or `/c/l/category` on the next line.
  slug = stripTypePrefix(slug);
  return `${prefix}${slug === '/' ? '' : slug}`;
}

/**
 * Build a category URL path (without market/locale prefix).
 * Use with `localePath()` to get the full URL.
 *
 * Input:  "/se/sv/material/epoxy"  or  "/material/epoxy"
 * Output: "/c/material/epoxy"
 */
export function categoryPath(canonicalUrl: string): string {
  return buildTypePrefixedPath(canonicalUrl, ROUTE_PATHS.category);
}

/**
 * Build a product URL path (without market/locale prefix).
 * Use with `localePath()` to get the full URL.
 *
 * Input:  "/se/sv/material/epoxy/product-name"
 * Output: "/p/material/epoxy/product-name"
 */
export function productPath(canonicalUrl: string): string {
  return buildTypePrefixedPath(canonicalUrl, ROUTE_PATHS.product);
}

/**
 * Build a brand URL path (without market/locale prefix).
 */
export function brandPath(canonicalUrl: string): string {
  return buildTypePrefixedPath(canonicalUrl, ROUTE_PATHS.brand);
}

/**
 * Build a search URL path (without market/locale prefix).
 */
export function searchPath(query: string): string {
  return `${ROUTE_PATHS.search}/${encodeURIComponent(query)}`;
}

/**
 * Build a discount campaign URL path.
 */
export function discountCampaignPath(canonicalUrl: string): string {
  return buildTypePrefixedPath(canonicalUrl, ROUTE_PATHS.discountCampaign);
}

/**
 * Strip type prefix from a path.
 * Used when passing aliases to API calls that don't expect them.
 *
 * "/c/material/epoxy" -> "/material/epoxy"
 * "/p/category/product-name" -> "/category/product-name"
 */
export function stripTypePrefix(path: string): string {
  const match = path.match(/^\/(?:c|p|b|l|s|dc)(\/.*)?$/);
  return match ? match[1] || '/' : path;
}

/**
 * Detect the route type from a type-prefixed path segment.
 * Returns null if no known type prefix is found.
 */
export function detectRouteType(
  firstSegment: string,
): keyof typeof ROUTE_PATHS | null {
  for (const [key, prefix] of Object.entries(ROUTE_PATHS)) {
    if (`/${firstSegment}` === prefix) {
      return key as keyof typeof ROUTE_PATHS;
    }
  }
  return null;
}

/**
 * Map a Geins alternate URL to the app typed route while PRESERVING the
 * url's own /{market}/{locale}/ segments.
 *
 * Unlike `buildTypePrefixedPath`, this helper does NOT strip the market/locale
 * and does NOT route through `localePath()`. It is designed for the locale
 * switcher where the alternate already carries its target-language market+locale
 * and we must not substitute the current locale.
 *
 * Handles both live-verified shapes:
 *  - Geins /l/ prefix (list): remapped to the app /c/ route for categories.
 *  - Already-correct app prefix (/p/, /c/, /b/): left unchanged (no /p/p/).
 *  - Prefix-less pretty path: app prefix injected after /{market}/{locale}/.
 *
 * Returns null for any unsafe or unroutable input:
 *  - non-string; no leading slash; protocol-relative (//); too few segments;
 *    non-2-letter market or locale; result has no valid app prefix at segment[2].
 *
 * Worked examples:
 *   alternateEntityPath('/se/en/l/category-1', 'category') -> '/se/en/c/category-1'
 *   alternateEntityPath('/se/en/materials/x', 'product')   -> '/se/en/p/materials/x'
 *   alternateEntityPath('/se/en/p/cat/item', 'product')    -> '/se/en/p/cat/item'
 *   alternateEntityPath('https://evil/x', 'product')       -> null
 */
export function alternateEntityPath(
  url: string,
  type: 'product' | 'category' | 'brand',
): string | null {
  if (typeof url !== 'string') return null;
  if (!url.startsWith('/')) return null;
  if (url.startsWith('//')) return null;

  // Strip query string and hash; alternates are canonical pages.
  const clean = url.split('?')[0]!.split('#')[0]!;
  const segments = clean.split('/').filter(Boolean);

  // Need /{market}/{locale}/{at least one more}.
  if (segments.length < 3) return null;

  const market = segments[0]!;
  const locale = segments[1]!;
  if (!/^[a-z]{2}$/.test(market)) return null;
  if (!/^[a-z]{2}$/.test(locale)) return null;

  let rest = segments.slice(2);

  // If the third segment is a Geins entity prefix, drop it; it will be
  // replaced by the app prefix for the requested type.
  if (GEINS_ENTITY_PREFIXES.has(rest[0]!)) {
    rest = rest.slice(1);
  }

  // Derive the app prefix for the requested type.
  const appPrefix = type === 'product' ? 'p' : type === 'category' ? 'c' : 'b';

  const result = `/${market}/${locale}/${appPrefix}/${rest.join('/')}`;

  // Final validation: result must be a well-formed type-prefixed path.
  const finalSegments = result.split('/').filter(Boolean);
  if (finalSegments.length < 4) return null;
  if (!/^[a-z]{2}$/.test(finalSegments[0]!)) return null;
  if (!/^[a-z]{2}$/.test(finalSegments[1]!)) return null;
  if (!APP_ROUTE_PREFIXES.has(finalSegments[2]!)) return null;

  return result;
}

// Re-export for convenience
export { ROUTE_PATHS };
