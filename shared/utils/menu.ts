import type { MenuItemType } from '../types/cms';

/**
 * Strip Geins market/locale/type prefix from a path.
 * Geins CMS canonical URLs include prefixes like:
 *   /se/sv/l/epoxi       → /epoxi       (category)
 *   /se/sv/p/cat/product  → /cat/product  (product)
 *   /se/sv/about-us       → /about-us     (CMS page)
 *
 * Pattern: /{market}/{locale}[/{type}]/{slug...}
 * where market = 2-char, locale = 2-4 char, type = single char (l, p, b, etc.)
 */
export function stripGeinsPrefix(path: string): string {
  // Match: /xx/xx-yy/ or /xx/xx/ prefix (market + locale)
  const prefixMatch = path.match(
    /^\/[a-z]{2}\/[a-z]{2}(?:-[a-z]{2})?(?:\/([a-z]))?(\/.*)$/i,
  );
  if (!prefixMatch) return path;

  const typeIndicator = prefixMatch[1]; // 'l', 'p', 'b', etc.
  const remainder = prefixMatch[2]!; // '/epoxi' or '/cat/product'

  // If there's a single-char type indicator, strip it (it's already consumed by the regex)
  if (typeIndicator) return remainder;

  // No type indicator — just market/locale prefix
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
