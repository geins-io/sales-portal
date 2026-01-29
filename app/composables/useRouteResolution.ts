import type { MaybeRefOrGetter } from 'vue';
import type { RouteResolution } from '#shared/types';

/**
 * Normalizes a route parameter (slug) into a consistent path format.
 *
 * @param slug - The slug parameter from the route (string, string[], or undefined)
 * @returns A normalized path string with leading slash and no trailing slash
 *
 * @example
 * normalizeSlugToPath(['category', 'product']) // '/category/product'
 * normalizeSlugToPath('category') // '/category'
 * normalizeSlugToPath([]) // '/'
 * normalizeSlugToPath(undefined) // '/'
 */
export function normalizeSlugToPath(
  slug: string | string[] | undefined,
): string {
  const parts = Array.isArray(slug) ? slug : slug ? [slug] : [];
  const clean = parts.filter((p) => typeof p === 'string' && p.length > 0);

  // Root path for empty segments
  if (clean.length === 0) return '/';

  // Ensure leading slash and no trailing slash
  return `/${clean.join('/')}`;
}

/**
 * Composable for resolving routes via the API.
 *
 * This composable handles fetching route resolution data from the server,
 * including support for reactive path values and automatic re-fetching on path changes.
 *
 * @param path - A reactive or static path string to resolve
 * @returns AsyncData object containing the route resolution, pending state, and error
 *
 * @example
 * // Basic usage with a static path
 * const { data, pending, error } = await useRouteResolution('/category/product');
 *
 * @example
 * // Usage with a reactive path
 * const path = computed(() => normalizeSlugToPath(route.params.slug));
 * const { data, pending, error } = await useRouteResolution(path);
 *
 * @example
 * // Usage with a getter function
 * const { data, pending, error } = await useRouteResolution(() => `/products/${productId.value}`);
 */
export function useRouteResolution(path: MaybeRefOrGetter<string>) {
  return useAsyncData<RouteResolution>(
    `route-resolution:${toValue(path)}`,
    () =>
      $fetch<RouteResolution>('/api/resolve-route', {
        query: { path: toValue(path) },
      }),
    { watch: [() => toValue(path)] },
  );
}
