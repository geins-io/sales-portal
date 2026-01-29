import { tenantConfigKey, getTenant } from '../utils/tenant';
import { createTenantLogger } from '../utils/logger';

export default defineCachedEventHandler(
  async (event) => {
    const { hostname } = event.context.tenant;
    const log = createTenantLogger(hostname);

    console.log('**** hostname', hostname);

    return withErrorHandling(
      async () => {
        log.debug('Fetching tenant configuration');

        const config = await getTenant(hostname);
        console.log('**** config', config);
        log.debug('Tenant configuration loaded successfully');
        return config;
      },
      { tenantId: hostname, operation: 'config.get' },
    );
  },
  {
    // Unique cache key
    getKey: (event) => tenantConfigKey(event.context.tenant.hostname),
    // Serve a stale cached response while asynchronously revalidating it
    swr: true,
    // Cache for 1 hour
    maxAge: 60 * 60,
    // Important: Prevent discarding tenant-specific headers
    // An array of request headers to be considered for the cache
    varies: ['host', 'x-forwarded-host'],
  },
);
