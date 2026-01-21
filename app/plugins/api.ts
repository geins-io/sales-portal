import { createApiClient, mergeHeaders } from '~/utils/api-client';

/**
 * API Plugin
 *
 * Creates and provides a configured API client instance with:
 * - Automatic retry logic with exponential backoff
 * - Request timeout handling
 * - Request/response interceptors
 * - Proper header forwarding for SSR
 *
 * Usage:
 * ```typescript
 * const { $api } = useNuxtApp();
 * const data = await $api('/endpoint', { method: 'GET' });
 * ```
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const requestHeaders = useRequestHeaders();

  // Create configured API client with retry logic and interceptors
  const api = createApiClient({
    // Use base URL from runtime config
    baseUrl: config.public.api.baseUrl,

    // Retry configuration
    retry: 3,
    retryDelay: 1000,
    maxRetryDelay: 30000,

    // Timeout from runtime config
    timeout: config.public.api.timeout,

    // Request interceptor: merge headers
    onRequest({ options }) {
      options.headers = mergeHeaders(
        options.headers,
        // Always include the original client request headers for SSR
        requestHeaders,
      );
    },

    // Response error handler: log errors and handle specific cases
    onResponseError({ response }) {
      // Handle 401 Unauthorized - could trigger re-authentication
      if (response?.status === 401) {
        // Emit an event or handle auth refresh
        // This could be expanded to use the auth store
        console.warn('[API] Unauthorized request - authentication may be required');
      }

      // Handle 403 Forbidden
      if (response?.status === 403) {
        console.warn('[API] Forbidden - insufficient permissions');
      }

      // Handle 429 Too Many Requests
      if (response?.status === 429) {
        console.warn('[API] Rate limited - too many requests');
      }
    },

    // Request error handler: log network errors
    onRequestError({ error }) {
      console.error('[API] Request error:', error.message);
    },
  });

  return {
    provide: { api }, // Expose helper to useNuxtApp().$api
  };
});
