import { createExternalApiError, withErrorHandling } from '../../utils/errors';

/** Default timeout for external API requests (30 seconds) */
const EXTERNAL_API_TIMEOUT_MS = 30000;

/** Headers that should be forwarded to the upstream API */
const HEADERS_TO_FORWARD = ['content-type', 'accept', 'authorization'];

export default defineEventHandler(async (event) => {
  // Remove the `/external/api` prefix from the path
  const targetPath = event.path.replace(/^\/api\/external\//, '');
  // Get the external API base URL from runtime config
  const config = useRuntimeConfig(event);
  // Set the request target utilizing our external API's base URL and the hostname
  const hostname = event.context.tenant.hostname;
  const target = new URL(
    `/${hostname}/${targetPath}`,
    config.externalApiBaseUrl,
  ).toString();

  return withErrorHandling(
    async () => {
      // Determine the request body when applicable
      const requestBody = ['PATCH', 'POST', 'PUT', 'DELETE'].includes(
        event.method,
      )
        ? await readRawBody(event)
        : undefined;

      // Build headers object by forwarding necessary headers from the incoming request
      const proxyHeaders: Record<string, string> = {};
      for (const header of HEADERS_TO_FORWARD) {
        const value = getHeader(event, header);
        if (value) {
          proxyHeaders[header] = value;
        }
      }

      try {
        return await sendProxy(event, target, {
          headers: proxyHeaders,
          fetchOptions: {
            method: event.method,
            body: requestBody,
            signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
          },
        });
      } catch (error) {
        // Handle timeout errors with a specific message
        if (error instanceof Error && error.name === 'TimeoutError') {
          throw createExternalApiError(
            'External API',
            new Error(`Request timed out after ${EXTERNAL_API_TIMEOUT_MS}ms`),
          );
        }

        // Handle abort errors (e.g., client disconnected)
        if (error instanceof Error && error.name === 'AbortError') {
          throw createExternalApiError(
            'External API',
            new Error('Request was aborted'),
          );
        }

        // Handle all other errors
        throw createExternalApiError('External API', error as Error);
      }
    },
    { operation: 'external-api-proxy' },
  );
});
