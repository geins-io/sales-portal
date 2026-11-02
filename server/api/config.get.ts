import type { H3Event } from 'h3';
import { configResponseCacheKey, storefrontCacheKey } from '../utils/tenant';
import { getPublicConfig } from '../services/tenant-config';
import { createTenantLogger } from '../utils/logger';
import { tenantRefusal } from '../utils/tenant-refusal';

/**
 * Computes the Nitro response-cache key for /api/config. The base key is the
 * storefront key (so every alias of one storefront shares a cache entry),
 * hex-encoded by `configResponseCacheKey`. Only ?preview=1 bypasses the cache
 * by appending a per-request suffix so every preview render rebuilds against
 * the latest unpublished appSettings. A stale preview cookie must NEVER produce
 * a preview key, otherwise it would poison the shared live cache entry for the
 * tenant.
 */
export function resolveConfigCacheKey(event: H3Event): string {
  const base = configResponseCacheKey(storefrontCacheKey(event));
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
        if (!publicConfig) {
          // The status a page gets for this host: the plugin's own refusal
          // when it made one (no host, loopback), else the lookup outcome's.
          // Thrown, not returned: a null return is an empty 204 carrying
          // this handler's s-maxage, and a thrown error is never cached.
          const { statusCode, statusMessage, message } =
            event.context.tenantRefusal ??
            tenantRefusal(event.context.tenant.resolution);
          throw createError({ statusCode, statusMessage, message });
        }
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
