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
 * `opts` overrides the OUTPUT market/locale while keeping the slug tail from
 * `url`. Use it for inbound RECOVERY, where the path being recovered carries
 * the locale the user asked for but the Geins canonicalUrl may be the
 * default-locale one: passing the requested market/locale keeps the user in
 * their locale instead of bouncing them to the canonical's. The locale
 * switcher OMITS opts so each alternate keeps its own target-language prefix.
 * A malformed override value falls back to the url's own segment.
 *
 * Worked examples:
 *   alternateEntityPath('/se/en/l/category-1', 'category') -> '/se/en/c/category-1'
 *   alternateEntityPath('/se/en/materials/x', 'product')   -> '/se/en/p/materials/x'
 *   alternateEntityPath('/se/en/p/cat/item', 'product')    -> '/se/en/p/cat/item'
 *   alternateEntityPath('/se/sv/c/kabel', 'category', { locale: 'en' }) -> '/se/en/c/kabel'
 *   alternateEntityPath('https://evil/x', 'product')       -> null
 */
export function alternateEntityPath(
  url: string,
  type: 'product' | 'category' | 'brand',
  opts?: { market?: string; locale?: string },
): string | null {
  if (typeof url !== 'string') return null;
  if (!url.startsWith('/')) return null;
  if (url.startsWith('//')) return null;

  // Strip query string and hash; alternates are canonical pages.
  const clean = url.split('?')[0]!.split('#')[0]!;
  const segments = clean.split('/').filter(Boolean);

  // Need /{market}/{locale}/{at least one more}.
  if (segments.length < 3) return null;

  const urlMarket = segments[0]!;
  const urlLocale = segments[1]!;
  if (!/^[a-z]{2}$/.test(urlMarket)) return null;
  if (!/^[a-z]{2}$/.test(urlLocale)) return null;

  // Output prefix: an override (recovery) wins over the url's own prefix, but
  // a malformed override falls back to the url segment so a bad caller value
  // can never produce an unroutable path.
  const market =
    opts?.market && /^[a-z]{2}$/.test(opts.market) ? opts.market : urlMarket;
  const locale =
    opts?.locale && /^[a-z]{2}$/.test(opts.locale) ? opts.locale : urlLocale;

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

/**
 * Decide whether a resolved category/brand listing should 301-redirect to its
 * canonical URL, and if so return the routable, locale-prefixed target.
 *
 * Geins returns prefix-less canonical URLs (e.g. `/se/sv/material/grenror`).
 * When a listing is reached at a non-canonical but valid URL (a short
 * `/c/<alias>` breadcrumb link, a stale ancestor path) the address is
 * normalized to the canonical `/c/` or `/b/` form for crawlers.
 *
 * Returns null when no redirect is warranted:
 *  - no canonical, or a non-string canonical;
 *  - the canonical is in a different market/locale than the current path (a
 *    locale fallback must not bounce the user out of the locale they asked for);
 *  - the routable target already equals the current path (loop guard).
 *
 * `localize` maps a locale-free path (`/c/...`) to the full app path
 * (`/se/sv/c/...`); pass `localePath` from `useLocaleMarket`. It is a
 * parameter so this stays a pure, unit-testable function.
 */
export function canonicalListRedirectTarget(
  canonicalUrl: string | null | undefined,
  currentPath: string,
  type: 'category' | 'brand',
  localize: (path: string) => string,
): string | null {
  if (!canonicalUrl || typeof canonicalUrl !== 'string') return null;
  if (!sameLocalePrefix(canonicalUrl, currentPath)) return null;
  const routable = localize(
    (type === 'brand' ? brandPath : categoryPath)(canonicalUrl),
  );
  return routable === currentPath ? null : routable;
}

/**
 * True when both paths share the same /{market}/{locale}/ prefix, or when
 * either is too short to carry one. Suppresses canonical normalization when a
 * locale fallback returned a canonical in a different locale.
 */
function sameLocalePrefix(a: string, b: string): boolean {
  const aSeg = a.split('/').slice(1, 3);
  const bSeg = b.split('/').slice(1, 3);
  if (aSeg.length < 2 || bSeg.length < 2) return true;
  return aSeg[0] === bSeg[0] && aSeg[1] === bSeg[1];
}

// Re-export for convenience
export { ROUTE_PATHS };
