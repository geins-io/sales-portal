import type { MenuType } from '#shared/types/cms';

/**
 * Fetch CMS menu data by location ID.
 *
 * Uses useFetch with dedupe:'defer' so multiple components calling
 * useMenuData('main') share the same request.
 */
export function useMenuData(menuLocationId: string) {
  const {
    data: menu,
    pending,
    error,
  } = useFetch<MenuType>('/api/cms/menu', {
    query: { menuLocationId },
    dedupe: 'defer',
  });

  return { menu, pending, error };
}
