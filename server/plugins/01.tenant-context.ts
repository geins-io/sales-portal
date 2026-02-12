// import { KV_STORAGE_KEYS } from '#shared/constants/storage';

/**
 * Normalizes a hostname by removing the port number.
 * This ensures consistent storage keys regardless of the port used.
 */
function normalizeHostname(hostname: string): string {
  // Remove port if present (e.g., "tenant-a.localhost:3000" -> "tenant-a.localhost")
  return hostname.split(':')[0] ?? hostname;
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    // Skip tenant context for health checks (allows direct IP access)
    const path = event.path || '';
    if (path.startsWith('/api/health')) {
      event.context.tenant = { hostname: '' };
      return;
    }

    // Get the request host for dynamic request routing
    // without considering the `X-Forwarded-Host` header which could be spoofed.
    const rawHostname = getRequestHost(event, { xForwardedHost: false });
    const hostname = normalizeHostname(rawHostname ?? '');

    // Validate hostname is present to prevent empty tenant IDs
    // polluting cache keys and storage
    if (!hostname) {
      throw createError({ statusCode: 400, message: 'Missing host header' });
    }

    // Attach tenant data to the event context to make it
    // available to all server routes and middleware.
    event.context.tenant = { hostname };

    // Set cookie for next request (future use: edge workers reading cookies before hitting origin)
    const cachedTenant = getTenantCookie(event);
    if (!cachedTenant || cachedTenant !== hostname) {
      setTenantCookie(event, hostname);
    }
  });
});
