import type { TenantConfig } from '#shared/types/tenant-config';
import { createTenant, tenantConfigKey } from '../utils/tenant';

export default defineCachedEventHandler(
  async (event) => {
    const { id, hostname } = event.context.tenant;
    const config = await useStorage('kv').getItem<TenantConfig>(
      tenantConfigKey(id),
    );

    if (!config) {
      // TODO: load config from API / REDIS etc
      // IF NOT FOUND, DO 404
      // THIS SHOULD BE REMOVED LATER
      const newConfig = await createTenant({
        hostname,
        tenantId: hostname,
      });

      // Alternatively, you could fallback to fetching the config from an API
      // For now, we'll return the newly created config instead of throwing an error
      return newConfig;
    }
    return config;
  },
  {
    // Unique cache key
    getKey: (event) => tenantConfigKey(event.context.tenant.id),
    // Serve a stale cached response while asynchronously revalidating it
    swr: true,
    // Cache for 1 hour
    maxAge: 60 * 60,
    // Important: Prevent discarding tenant-specific headers
    // An array of request headers to be considered for the cache
    varies: ['host', 'x-forwarded-host'],
  },
);
