import type { TenantConfig } from '#shared/types/tenant-config';
import { createTenant } from '../utils/tenant';

export default defineCachedEventHandler(
  async (event) => {
    const { id, hostname } = event.context.tenant;
    console.log('defineCachedEventHandler -> id', id);
    console.log('defineCachedEventHandler -> hostname', hostname);

    // Validate that tenant ID exists

    // Retrieve tenant configuration from KV storage
    // using the tenant's ID as the key

    const config = await useStorage('kv').getItem<TenantConfig>(
      `tenant:config:${id}`,
    );

    if (!config) {
      // Create tenant with default config if not found
      // TODO: load config from API / REDIS etc
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
    getKey: (event) => `tenant:config:${event.context.tenant.id}`,
    // Serve a stale cached response while asynchronously revalidating it
    swr: true,
    // Cache for 1 hour
    maxAge: 60 * 60,
    // Important: Prevent discarding tenant-specific headers
    // An array of request headers to be considered for the cache
    varies: ['host', 'x-forwarded-host'],
  },
);
