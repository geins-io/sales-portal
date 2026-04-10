import type { MenuItemType } from '../types/cms';
import { ROUTE_PATHS } from '../constants/route-paths';
import { SUPPORTED_LOCALE_CODES } from '../utils/locale-market';

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
 * CMS-generated page URLs may omit the market segment:
 *   /en/about-us          → /about-us       (locale-only prefix)
 *   /sv/om-oss            → /om-oss
 *
 * Pattern 1: /{market}/{locale}[/{type}]/{slug...}
 * Pattern 2: /{locale}/{slug...} (CMS-generated, no market)
 */
export function stripGeinsPrefix(path: string): string {
  // Pattern 1: /xx/xx-yy/ or /xx/xx/ prefix (market + locale)
  // Then optionally a type indicator (1-2 chars) followed by /
  const fullMatch = path.match(
    /^\/[a-z]{2}\/[a-z]{2}(?:-[a-z]{2})?(?:\/(dc|[a-z])(?=\/))?(\/.*)$/i,
  );
  if (fullMatch) {
    const typeIndicator = fullMatch[1];
    const remainder = fullMatch[2]!;

    if (typeIndicator) {
      const routePrefix = GEINS_TYPE_MAP[typeIndicator.toLowerCase()];
      if (routePrefix) {
        return `${routePrefix}${remainder}`;
      }
      return remainder;
    }

    return remainder;
  }

  // Pattern 2: /{locale}/{slug...} — CMS-generated URLs with locale-only prefix.
  // Only strip known locale codes to avoid false positives (e.g. /dc/ is a type, not a locale).
  const segments = path.split('/').filter(Boolean);
  if (
    segments.length >= 2 &&
    (SUPPORTED_LOCALE_CODES as readonly string[]).includes(segments[0]!)
  ) {
    return '/' + segments.slice(1).join('/');
  }

  return path;
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
 * Add type prefix to a normalized menu URL if it doesn't already have one.
 * Menu items for categories come from the API without /c/ prefix.
 * Detects categories by item.children presence or item.type.
 */
export function addCategoryPrefix(
  url: string,
  item: Partial<MenuItemType>,
): string {
  if (!url || url === '/') return url;
  // Already has a type prefix — no change
  const firstSeg = url.split('/').filter(Boolean)[0];
  const knownPrefixes = Object.values(ROUTE_PATHS).map((p) =>
    p.replace('/', ''),
  );
  if (firstSeg && knownPrefixes.includes(firstSeg)) return url;
  // Menu item with children = category
  if ((item as MenuItemType).children?.length)
    return `${ROUTE_PATHS.category}${url}`;
  // Menu item of type 'category' from CMS
  if (item.type === 'category') return `${ROUTE_PATHS.category}${url}`;
  return url;
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
