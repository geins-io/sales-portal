import type { MenuItemType } from '../types/cms';
import { ROUTE_PATHS } from '../constants/route-paths';

/**
 * Geins type indicator → our route prefix mapping.
 * Geins CMS uses single-char type indicators: l (list/category), p (product), b (brand), s (search), dc (discount campaign).
 * We map them to our type-prefixed route paths.
 */
const GEINS_TYPE_MAP: Record<string, string> = {
  l: ROUTE_PATHS.category, // /l/ → /c/
  p: ROUTE_PATHS.product, // /p/ → /p/
  b: ROUTE_PATHS.brand, // /b/ → /b/
  s: ROUTE_PATHS.search, // /s/ → /s/
  dc: ROUTE_PATHS.discountCampaign, // /dc/ → /dc/
};

/**
 * Strip Geins market/locale prefix from a path and convert type indicators
 * to our type-prefixed route paths.
 *
 * Geins CMS canonical URLs include prefixes like:
 *   /se/sv/l/epoxi       → /c/epoxi       (category — 'l' maps to '/c')
 *   /se/sv/p/cat/product  → /p/cat/product  (product)
 *   /se/sv/about-us       → /about-us       (CMS page — no type indicator)
 *
 * Pattern: /{market}/{locale}[/{type}]/{slug...}
 * where market = 2-char, locale = 2-4 char, type = single char (l, p, b, etc.) or 'dc'
 */
export function stripGeinsPrefix(path: string): string {
  // Match: /xx/xx-yy/ or /xx/xx/ prefix (market + locale)
  // Then optionally a type indicator (1-2 chars) followed by /
  const prefixMatch = path.match(
    /^\/[a-z]{2}\/[a-z]{2}(?:-[a-z]{2})?(?:\/(dc|[a-z])(?=\/))?(\/.*)$/i,
  );
  if (!prefixMatch) return path;

  const typeIndicator = prefixMatch[1]; // 'l', 'p', 'b', 'dc', etc. (only if followed by /)
  const remainder = prefixMatch[2]!; // '/epoxi' or '/cat/product'

  if (typeIndicator) {
    // Map the Geins type indicator to our route prefix
    const routePrefix = GEINS_TYPE_MAP[typeIndicator.toLowerCase()];
    if (routePrefix) {
      return `${routePrefix}${remainder}`;
    }
    // Unknown type indicator — just strip it
    return remainder;
  }

  // No type indicator — CMS page, just strip market/locale
  return remainder;
}

/**
 * Normalize a CMS canonical URL to a relative path for our app routing.
 * CMS stores absolute URLs like `https://tenant.example.com/se/sv/l/epoxi`.
 * We strip the host and Geins market/locale/type prefixes so NuxtLink works.
 */
export function normalizeMenuUrl(
  canonicalUrl: string | undefined | null,
  currentHost?: string,
): string {
  if (!canonicalUrl) return '';

  let path = canonicalUrl;

  // If absolute URL, extract pathname
  if (!canonicalUrl.startsWith('/')) {
    try {
      const parsed = new URL(canonicalUrl);
      if (currentHost && parsed.host !== currentHost) {
        // External URL — return as-is
        return canonicalUrl;
      }
      path = parsed.pathname + parsed.search + parsed.hash;
    } catch {
      return canonicalUrl;
    }
  }

  return stripGeinsPrefix(path);
}

/**
 * Get display label for a menu item. CMS uses `label` as primary, `title` as fallback.
 */
export function getMenuLabel(item: Partial<MenuItemType>): string {
  return item.label || item.title || '';
}

/**
 * Filter hidden items and sort by order. Returns a new array.
 */
export function getVisibleItems(
  items: MenuItemType[] | undefined | null,
): MenuItemType[] {
  if (!items?.length) return [];
  return items
    .filter((item) => item.hidden !== true)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Check if a URL points to an external host.
 */
export function isExternalUrl(url: string, currentHost?: string): boolean {
  if (!url || url.startsWith('/')) return false;
  try {
    const parsed = new URL(url);
    if (currentHost) return parsed.host !== currentHost;
    return true;
  } catch {
    return false;
  }
}
