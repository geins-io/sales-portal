import { ROUTE_PATHS } from '../constants/route-paths';

/**
 * Strip the Geins market/locale prefix from a canonical URL and prepend
 * a route-type prefix. The result is a locale-free path ready to be
 * wrapped by `localePath()`.
 *
 * The Geins API returns canonical URLs with market/locale but WITHOUT
 * type prefixes:
 *   /se/sv/material/epoxy          → /c/material/epoxy
 *   /se/sv/material/epoxy/product  → /p/material/epoxy/product
 *
 * If the URL has no locale/market prefix:
 *   /material/epoxy                → /c/material/epoxy
 */
function buildTypePrefixedPath(canonicalUrl: string, prefix: string): string {
  // Strip /{market}/{locale} prefix if present
  const match = canonicalUrl.match(
    /^\/[a-z]{2}\/[a-z]{2}(?:-[a-z]{2})?(\/.*)?$/,
  );
  const slug = match ? match[1] || '/' : canonicalUrl;
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
 * "/c/material/epoxy" → "/material/epoxy"
 * "/p/category/product-name" → "/category/product-name"
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

// Re-export for convenience
export { ROUTE_PATHS };
