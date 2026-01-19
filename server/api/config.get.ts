import { createTenant, tenantConfigKey, getTenant } from '../utils/tenant';
import { createTenantLogger } from '../utils/logger';
import {
  createTenantNotFoundError,
  createTenantInactiveError,
  withErrorHandling,
} from '../utils/errors';

export default defineCachedEventHandler(
  async (event) => {
    const { id, hostname } = event.context.tenant;
    const log = createTenantLogger(id, hostname);

    return withErrorHandling(
      async () => {
        log.debug('Fetching tenant configuration');

        const config = await getTenant(id);

        if (!config) {
          log.info('Tenant not found, creating default configuration');

          // In development, auto-create tenants for easier testing
          // In production, this should return a 404 or load from external source
          if (process.env.NODE_ENV === 'development') {
            const newConfig = await createTenant({
              hostname,
              tenantId: hostname,
            });
            log.info('Created new tenant configuration');
            return newConfig;
          }

          // In production, throw a not found error
          throw createTenantNotFoundError(hostname);
        }

        // Check if tenant is active
        if (config.isActive === false) {
          log.warn('Attempted to access inactive tenant');
          throw createTenantInactiveError(id);
        }

        log.debug('Tenant configuration loaded successfully');
        return config;
      },
      { tenantId: id, operation: 'config.get' },
    );
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
