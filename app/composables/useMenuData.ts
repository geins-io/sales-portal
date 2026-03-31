import type { MenuType } from '#shared/types/cms';

/**
 * Fetch CMS menu data by location ID.
 *
 * Includes locale/market in the query so SSR internal fetches resolve
 * the correct language. During SSR, internal useFetch calls don't go
 * through the locale plugin — the query params ensure the server API
 * reads the correct locale.
 */
export function useMenuData(menuLocationId: string) {
  const { currentLocale, currentMarket } = useLocaleMarket();

  const {
    data: menu,
    pending,
    error,
  } = useFetch<MenuType>('/api/cms/menu', {
    query: computed(() => ({
      menuLocationId,
      ...(currentLocale.value ? { locale: currentLocale.value } : {}),
      ...(currentMarket.value ? { market: currentMarket.value } : {}),
    })),
    dedupe: 'defer',
  });

  return { menu, pending, error };
}
