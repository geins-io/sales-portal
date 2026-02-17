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
    getKey: (event) =>
      tenantConfigKey(
        event.context.tenant.tenantId || event.context.tenant.hostname,
      ),
    // Serve a stale cached response while asynchronously revalidating it
    swr: true,
    // Cache for 1 hour
    maxAge: 60 * 60,
    // Important: Prevent discarding tenant-specific headers
    // An array of request headers to be considered for the cache
    varies: ['host', 'x-forwarded-host'],
  },
);
