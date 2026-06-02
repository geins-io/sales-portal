import type { H3Event } from 'h3';
import { tenantConfigKey } from '../utils/tenant';
import { getPublicConfig } from '../services/tenant-config';
import { createTenantLogger } from '../utils/logger';

/**
 * Computes the Nitro response-cache key for /api/config. The base key uses
 * tenantId (so multiple hostnames for one tenant share a cache entry) and
 * falls back to hostname. Only ?preview=1 bypasses the cache by appending a
 * per-request suffix so every preview render rebuilds against the latest
 * unpublished appSettings. A stale preview cookie must NEVER produce a preview
 * key, otherwise it would poison the shared live cache entry for the tenant.
 */
export function resolveConfigCacheKey(event: H3Event): string {
  const base = tenantConfigKey(
    event.context.tenant.tenantId || event.context.tenant.hostname,
  );
  return getQuery(event).preview === '1'
    ? `${base}:settings-preview:${Date.now()}`
    : base;
}

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
    getKey: (event) => resolveConfigCacheKey(event),
    // Serve a stale cached response while asynchronously revalidating it
    swr: true,
    // Cache for 1 hour
    maxAge: 60 * 60,
  },
);
