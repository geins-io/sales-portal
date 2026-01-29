import type { UseFetchOptions } from 'nuxt/app';

/**
 * Composable for making API calls with the configured $api fetch instance.
 *
 * This composable leverages Nuxt 4's built-in `useFetch` with the `dedupe` option
 * for automatic request deduplication, SSR payload transfer, and caching.
 *
 * @param url - The URL to fetch (can be a string or a reactive getter function)
 * @param options - UseFetch options (dedupe defaults to 'defer' to prevent duplicate requests)
 * @returns AsyncData object from useFetch
 *
 * @example
 * ```ts
 * // Basic usage
 * const { data, pending, error } = useApi<User>('/api/user');
 *
 * // With options
 * const { data } = useApi('/api/products', {
 *   query: { page: 1 },
 *   dedupe: 'cancel', // Cancel previous request if a new one is made
 * });
 * ```
 */
export function useApi<T>(
  url: string | (() => string),
  options?: UseFetchOptions<T>,
) {
  return useFetch(url, {
    // Use 'defer' as default to return existing request for duplicate calls
    // This matches the previous manual deduplication behavior
    dedupe: 'defer',
    ...options,
    $fetch: useNuxtApp().$api as typeof $fetch,
  });
}
