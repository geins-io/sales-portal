import type { TenantConfig } from '@/shared/types/tenant-config';
export default defineCachedEventHandler<TenantConfig>(
  async (event) => {
    const { id, hostname } = event.context.tenant;
    // Retrieve tenant configuration from KV storage
    // using the tenant's ID as the key
    const config = await useStorage('kv').getItem<TenantConfig>(
      `tenant:config:${id}`,
    );

    if (!config) {
      // Alternatively, you could fallback to fetching the config from an API
      throw createError({
        statusCode: 404,
        statusMessage: `Tenant config not found for '${hostname}'`,
      });
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
