import { NuxtLink } from '#components';
import type { MenuItemType } from '#shared/types/cms';
import {
  addCategoryPrefix,
  getVisibleItems,
  isExternalUrl,
  normalizeMenuUrl,
} from '#shared/utils/menu';

/**
 * A header menu item as a link: its tag (NuxtLink, or a plain anchor for
 * external links), its attributes, and its visible children. Shared by the
 * header nav and its menu layouts.
 */
export function useHeaderMenuLinks() {
  const currentHost = computed(() => useRequestURL().host);
  const { localePath } = useLocaleMarket();

  function visibleChildren(item: MenuItemType): MenuItemType[] {
    return getVisibleItems(item.children);
  }

  function isExternal(item: MenuItemType): boolean {
    const url = normalizeMenuUrl(item.canonicalUrl, currentHost.value);
    return isExternalUrl(url, currentHost.value) || !!item.targetBlank;
  }

  function linkTag(item: MenuItemType) {
    return isExternal(item) ? 'a' : NuxtLink;
  }

  function linkAttrs(item: MenuItemType): Record<string, string | undefined> {
    let url = normalizeMenuUrl(item.canonicalUrl, currentHost.value, item.type);
    const ext = isExternal(item);
    if (!ext) url = addCategoryPrefix(url, item);
    const href = ext ? url || '/' : localePath(url || '/');
    return {
      [ext ? 'href' : 'to']: href,
      target: ext ? '_blank' : undefined,
      rel: ext ? 'noopener' : undefined,
    };
  }

  return { visibleChildren, linkTag, linkAttrs };
}
