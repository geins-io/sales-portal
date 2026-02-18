import { resolveTenant } from '../utils/tenant';

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
    // Skip tenant context for health checks and internal endpoints (webhooks)
    const path = event.path || '';
    if (path.startsWith('/api/health') || path.startsWith('/api/internal/')) {
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

    // For page routes, eagerly resolve the tenant and cache the tenantId in a cookie.
    // resolveTenant() returns null for both missing and inactive tenants.
    // Static assets and API routes are excluded.
    if (
      !path.startsWith('/api/') &&
      !path.startsWith('/_nuxt/') &&
      !path.startsWith('/__nuxt')
    ) {
      const tenant = await resolveTenant(hostname, event);
      if (!tenant) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Not Found',
          message: `This site is not available. If you believe this is an error, please contact support.`,
        });
      }

      // Store the real tenantId and full config in context
      const tenantId = tenant.tenantId || hostname;
      event.context.tenant.tenantId = tenantId;
      event.context.tenant.config = tenant;

      const cachedTenantId = getTenantCookie(event);
      if (!cachedTenantId || cachedTenantId !== tenantId) {
        setTenantCookie(event, tenantId);
      }
    } else if (path.startsWith('/api/')) {
      // For API routes, always resolve from hostname (cookie is only a hint, never trusted)
      const tenant = await resolveTenant(hostname, event);
      if (tenant) {
        event.context.tenant.tenantId = tenant.tenantId || hostname;
        event.context.tenant.config = tenant;
      }
    }
  });
});
