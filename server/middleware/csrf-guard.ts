/**
 * CSRF guard — rejects mutating API requests with non-JSON content types.
 *
 * Browsers can forge cross-origin POST requests via <form> submissions
 * (application/x-www-form-urlencoded, multipart/form-data) but cannot
 * set Content-Type: application/json without a CORS preflight.
 * Combined with SameSite: lax cookies, this blocks CSRF without tokens.
 *
 * Excluded: GET, HEAD, OPTIONS (safe methods), non-API paths, webhook endpoint
 * (which uses its own HMAC signature verification).
 */
export default defineEventHandler((event) => {
  const path = event.path || '';
  const method = event.method?.toUpperCase();

  // Only guard mutating methods on API routes
  if (
    !path.startsWith('/api/') ||
    !method ||
    ['GET', 'HEAD', 'OPTIONS'].includes(method)
  ) {
    return;
  }

  // Webhook endpoint uses HMAC verification, not JSON content type
  if (path.startsWith('/api/internal/')) {
    return;
  }

  const contentType = getHeader(event, 'content-type') || '';

  // Allow JSON and empty bodies (some POST endpoints like logout may have no body)
  if (contentType.includes('application/json') || contentType === '') {
    return;
  }

  throw createError({
    statusCode: 415,
    message: 'Unsupported Media Type',
  });
});
