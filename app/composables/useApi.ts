import type { UseFetchOptions } from 'nuxt/app';

/**
 * Map to store pending requests for deduplication
 * Key: serialized request key (url + options)
 * Value: The useFetch return value (AsyncData)
 */
const pendingRequests = new Map<string, ReturnType<typeof useFetch>>();

/**
 * Generates a unique key for a request based on URL and options
 * Used for request deduplication
 */
function generateRequestKey<T>(
  url: string | (() => string),
  options?: UseFetchOptions<T>,
): string {
  // For function URLs, we use a placeholder since the actual URL may be reactive
  const urlKey = typeof url === 'function' ? `[fn:${url.toString()}]` : url;

  // Create a stable key from options, excluding functions and reactive refs
  const optionsKey = options
    ? JSON.stringify(options, (key, value) => {
        // Skip functions and internal Nuxt options that shouldn't affect deduplication
        if (typeof value === 'function') return '[function]';
        if (key === '$fetch') return undefined;
        if (
          key === 'onRequest' ||
          key === 'onResponse' ||
          key === 'onRequestError' ||
          key === 'onResponseError'
        ) {
          return '[callback]';
        }
        return value;
      })
    : '';

  return `${urlKey}::${optionsKey}`;
}

/**
 * Composable for making API calls with the configured $api fetch instance
 * Includes request deduplication to prevent simultaneous duplicate requests
 *
 * @param url - The URL to fetch (can be a string or a reactive getter function)
 * @param options - UseFetch options
 * @returns AsyncData object from useFetch
 */
export function useApi<T>(
  url: string | (() => string),
  options?: UseFetchOptions<T>,
) {
  const key = generateRequestKey(url, options);

  // Check if there's already a pending request with the same key
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as ReturnType<typeof useFetch<T>>;
  }

  // Create the new request
  const request = useFetch(url, {
    ...options,
    $fetch: useNuxtApp().$api as typeof $fetch,
  });

  // Store the pending request
  pendingRequests.set(key, request);

  // Clean up after the request completes (whether success or error)
  // We use the internal promise from the AsyncData object
  request
    .then(() => {
      pendingRequests.delete(key);
    })
    .catch(() => {
      pendingRequests.delete(key);
    });

  return request;
}

/**
 * Clears all pending requests from the deduplication cache
 * Useful for testing or when navigating away from a page
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Gets the current count of pending requests
 * Useful for debugging and testing
 */
export function getPendingRequestsCount(): number {
  return pendingRequests.size;
}
