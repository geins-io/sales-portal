import { createApiClient, mergeHeaders } from '~/utils/api-client';
import { logger } from '~/utils/logger';

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
/**
 * Allowlist of safe headers to forward during SSR.
 * `cookie` is deliberately absent, so this client cannot authenticate an
 * auth-gated route during SSR — use `internalFetch` or `useFetch` for those.
 */
const SAFE_HEADERS_ALLOWLIST = [
  'accept',
  'accept-language',
  'user-agent',
  'host', // Required for multi-tenant SSR to forward the original request hostname
] as const;

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  // Forward only the allowlisted headers; see SAFE_HEADERS_ALLOWLIST above
  const requestHeaders = useRequestHeaders([...SAFE_HEADERS_ALLOWLIST]);

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
      const merged = mergeHeaders(
        options.headers,
        // Always include the original client request headers for SSR
        requestHeaders,
      );
      options.headers = new Headers(merged);
    },

    // Response error handler: log errors and handle specific cases
    onResponseError({ response }) {
      // Handle 401 Unauthorized - could trigger re-authentication
      if (response?.status === 401) {
        logger.warn('Unauthorized request - authentication may be required');
      }

      // Handle 403 Forbidden
      if (response?.status === 403) {
        logger.warn('Forbidden - insufficient permissions');
      }

      // Handle 429 Too Many Requests
      if (response?.status === 429) {
        logger.warn('Rate limited - too many requests');
      }
    },

    // Request error handler: log network errors
    onRequestError({ error }) {
      logger.error('Request error', { message: error.message });
    },
  });

  return {
    provide: { api }, // Expose helper to useNuxtApp().$api
  };
});
