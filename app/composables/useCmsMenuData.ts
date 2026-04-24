import type { MenuType } from '#shared/types/cms';
import type { CmsMenuKey } from '#shared/constants/cms';

/**
 * High-level menu fetcher keyed by CMS menu registry key.
 *
 * Resolves the tenant's configured `menuLocationId` for this key, then
 * fetches the menu from `/api/cms/menu`. When the tenant has not
 * configured the key, `isConfigured.value` is false, `menu` stays null,
 * and no fetch fires.
 *
 * Consumers render a minimal hardcoded fallback nav when:
 *   - `isConfigured.value === false`, OR
 *   - `error.value` is set, OR
 *   - the fetch succeeds but `menu.value.menuItems` is empty.
 *
 * This is the only way new code should read CMS menus.
 */
export function useCmsMenuData(key: CmsMenuKey) {
  const { localeQuery } = useLocaleMarket();
  const menuCfg = useCmsMenu(key);
  const isConfigured = computed(() => !!menuCfg.value?.menuLocationId);

  const {
    data: menu,
    pending,
    error,
  } = useFetch<MenuType>('/api/cms/menu', {
    query: computed(() =>
      isConfigured.value
        ? {
            menuLocationId: menuCfg.value!.menuLocationId,
            ...localeQuery.value,
          }
        : { skip: '1' },
    ),
    immediate: isConfigured.value,
    dedupe: 'defer',
  });

  return { menu, pending, error, isConfigured };
}
