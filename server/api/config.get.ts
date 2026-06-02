import { tenantConfigKey } from '../utils/tenant';
import { getPublicConfig } from '../services/tenant-config';
import { createTenantLogger } from '../utils/logger';

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
    // When ?preview=1 is present, append a per-request suffix so Nitro never
    // serves a cached preview response (every preview render must rebuild
    // against the latest unpublished appSettings).
    getKey: (event) => {
      const base = tenantConfigKey(
        event.context.tenant.tenantId || event.context.tenant.hostname,
      );
      // Only ?preview=1 bypasses the cache; a cookie never marks a preview
      // render so a stale preview cookie can't poison the live cache entry.
      const isPreview = getQuery(event).preview === '1';
      return isPreview ? `${base}:settings-preview:${Date.now()}` : base;
    },
    // Serve a stale cached response while asynchronously revalidating it
    swr: true,
    // Cache for 1 hour
    maxAge: 60 * 60,
  },
);
