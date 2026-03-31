import type { MenuType } from '#shared/types/cms';

/**
 * Fetch CMS menu data by location ID.
 *
 * Uses useFetch with dedupe:'defer' so multiple components calling
 * useMenuData('main') share the same request.
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
      // Include locale/market in query so useFetch cache key is locale-aware.
      // The server ignores these (reads from resolvedLocaleMarket/cookies),
      // but they differentiate the client-side cache between locales.
      locale: currentLocale.value,
      market: currentMarket.value,
    })),
    dedupe: 'defer',
  });

  return { menu, pending, error };
}
