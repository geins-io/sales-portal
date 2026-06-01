import { tenantConfigKey } from '../utils/tenant';
import { getPublicConfig } from '../services/tenant-config';
import { createTenantLogger } from '../utils/logger';
import { getStoreSettingsPreviewCookie } from '../utils/cookies';

export default defineCachedEventHandler(
  async (event) => {
    const { hostname } = event.context.tenant;
    const log = createTenantLogger(hostname);

    return withErrorHandling(
      async () => {
        log.debug('Fetching tenant configuration');
        const publicConfig = await getPublicConfig(event);
        log.debug('Tenant configuration loaded successfully');

        return publicConfig;
      },
      { tenantId: hostname, operation: 'config.get' },
    );
  },
  {
    // Cache key uses tenantId (from cookie/context) so multiple hostnames
    // for the same tenant share one cache entry. Falls back to hostname.
    // When the store-settings preview cookie is set, append a per-request
    // suffix so Nitro never serves a cached preview response (every preview
    // render must rebuild against the latest unpublished appSettings).
    getKey: (event) => {
      const base = tenantConfigKey(
        event.context.tenant.tenantId || event.context.tenant.hostname,
      );
      // Both the cookie and the ?preview=1 query mark a preview render.
      // The first preview request from Studio has no cookie yet (the cookie
      // is set on the response), so the query must also bypass the cache.
      const isPreview =
        getStoreSettingsPreviewCookie(event) || getQuery(event).preview === '1';
      return isPreview ? `${base}:settings-preview:${Date.now()}` : base;
    },
    // Serve a stale cached response while asynchronously revalidating it
    swr: true,
    // Cache for 1 hour
    maxAge: 60 * 60,
  },
);
