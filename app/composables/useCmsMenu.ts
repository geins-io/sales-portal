import type { CmsMenuConfig, CmsMenuKey } from '#shared/constants/cms';

/**
 * Resolve a CMS menu key against the current tenant configuration.
 *
 * Returns `null` when the menu is not configured for this tenant or
 * when the tenant config has not loaded yet. Consumers MUST handle the
 * null case by rendering a minimal fallback nav — a storefront should
 * never render without navigation.
 *
 * Mirrors `useCmsSlot`. Tenant config is the single source of truth —
 * there is no global defaults map.
 */
export function useCmsMenu(key: CmsMenuKey): ComputedRef<CmsMenuConfig | null> {
  const { tenant } = useTenant();
  return computed(() => {
    const menu = tenant.value?.cms?.menus?.[key];
    if (!menu?.menuLocationId) return null;
    return menu;
  });
}
