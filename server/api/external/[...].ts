import { createExternalApiError } from '../../utils/errors';

/** Default timeout for external API requests (30 seconds) */
const EXTERNAL_API_TIMEOUT_MS = 30000;

/** Headers that should be forwarded to the upstream API */
const HEADERS_TO_FORWARD = ['content-type', 'accept', 'authorization'];

export default defineEventHandler(async (event) => {
  // Remove the `/external/api` prefix from the path
  const targetPath = event.path.replace(/^\/api\/external\//, '');
  // Set the request target utilizing our external API's base URL and the tenant ID
  const tenantId = event.context.tenant.id;
  const target = new URL(
    `/${tenantId}/${targetPath}`,
    'https://api.app.com',
  ).toString();

  try {
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
});
