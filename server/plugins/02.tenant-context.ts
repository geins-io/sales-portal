import { COOKIE_NAMES } from '#shared/constants/storage';
import { resolveTenant, resolvePreviewTenant } from '../utils/tenant';

/** Drops the port so storage keys are stable across ports. */
function normalizeHostname(hostname: string): string {
  return hostname.split(':')[0] ?? hostname;
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    // Locale/market handling lives in `server/middleware/00.locale-market.ts`,
    // which runs AFTER plugins; this hook only has to leave the tenant config
    // on the context. headersSent guards against a future plugin responding
    // early.
    if (event.node.res.headersSent) return;

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

    // Preview is activated ONLY by `?preview=1`, never inferred from a cookie:
    // a clean visit must render the live theme. CMS preview is a separate flag.
    const isStoreSettingsPreview = getQuery(event).preview === '1';

    event.context.tenant = { hostname };

    // resolveTenant() returns null for both missing and inactive tenants.
    if (
      !path.startsWith('/api/') &&
      !path.startsWith('/_nuxt/') &&
      !path.startsWith('/__nuxt')
    ) {
      const tenant = isStoreSettingsPreview
        ? await resolvePreviewTenant(hostname, event)
        : await resolveTenant(hostname, event);
      if (!tenant) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Not Found',
          message: `This site is not available. If you believe this is an error, please contact support.`,
        });
      }

      const tenantId = tenant.tenantId || hostname;
      event.context.tenant.tenantId = tenantId;
      event.context.tenant.config = tenant;

      const cachedTenantId = getTenantCookie(event);

      // On a tenant switch, drop stale cookies so the new tenant's defaults
      // apply. A `?preview=1` request must never mutate persistent state.
      if (
        !isStoreSettingsPreview &&
        cachedTenantId &&
        cachedTenantId !== tenantId
      ) {
        deleteCookie(event, COOKIE_NAMES.LOCALE, { path: '/' });
        deleteCookie(event, COOKIE_NAMES.MARKET, { path: '/' });
        deleteCookie(event, COOKIE_NAMES.CART_ID, { path: '/' });
      }

      if (
        !isStoreSettingsPreview &&
        (!cachedTenantId || cachedTenantId !== tenantId)
      ) {
        setTenantCookie(event, tenantId);
      }
    } else if (path.startsWith('/api/')) {
      // Hostname only — the cookie is a hint, never trusted.
      const tenant = isStoreSettingsPreview
        ? await resolvePreviewTenant(hostname, event)
        : await resolveTenant(hostname, event);
      if (tenant) {
        event.context.tenant.tenantId = tenant.tenantId || hostname;
        event.context.tenant.config = tenant;
      }
    }
  });
});
