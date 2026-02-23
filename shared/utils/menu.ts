import type { MenuItemType } from '../types/cms';

/**
 * Normalize a CMS canonical URL to a relative path if it belongs to the current host.
 * CMS stores absolute URLs like `https://tenant.example.com/se/sv/l/epoxi`.
 * We strip the host part for internal navigation so NuxtLink works.
 */
export function normalizeMenuUrl(
  canonicalUrl: string | undefined | null,
  currentHost?: string,
): string {
  if (!canonicalUrl) return '';

  // Already relative
  if (canonicalUrl.startsWith('/')) return canonicalUrl;

  try {
    const parsed = new URL(canonicalUrl);
    if (currentHost && parsed.host === currentHost) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // Not a valid URL — return as-is
  }

  return canonicalUrl;
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
