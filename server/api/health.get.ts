/**
 * Health Check Endpoint
 *
 * Provides health status for the Sales Portal with multiple response levels:
 *
 * **Quick mode (fastest response):** Skips storage checks for fast startup
 * - GET /api/health?quick=true
 *
 * **Public (default):** Returns only status and timestamp
 * - GET /api/health
 *
 * **Detailed (requires secret):** Returns full metrics including:
 * - Application version and environment
 * - Storage connectivity (KV/Redis)
 * - Memory usage details
 * - Uptime information
 * - GET /api/health?key=YOUR_SECRET
 *
 * Used by:
 * - Azure App Service health probes (public)
 * - Load balancers (public)
 * - Monitoring systems (detailed)
 * - Application Insights availability tests (public or detailed)
 */

import type { H3Event } from 'h3';
import { createTimer, logger } from '../utils/logger';

/**
 * Health check result for individual components
 */
interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Minimal health response (public)
 */
interface HealthResponseMinimal {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
}

/**
 * Detailed health response (requires authentication)
 */
interface HealthResponseDetailed extends HealthResponseMinimal {
  version: string;
  commitSha: string;
  uptime: number;
  environment: string;
  checks: {
    storage?: ComponentHealth;
    memory?: ComponentHealth;
  };
}

async function getEnvironment(event: H3Event): Promise<string> {
  const config = useRuntimeConfig(event);
  return config.public.environment as string;
}

/**
 * Check storage connectivity (KV store)
 *
 * Note: Storage check is optional - if using filesystem storage in production
 * without a configured directory, we report as 'degraded' rather than 'unhealthy'
 * since the app can function without KV storage for many use cases.
 */
async function checkStorage(event: H3Event): Promise<ComponentHealth> {
  const timer = createTimer();
  const config = useRuntimeConfig(event);
  const storageDriver = config.storage?.driver || 'fs';

  try {
    const storage = useStorage('kv');

    // Try to read and write a test key
    const testKey = '_health_check';
    const testValue = Date.now().toString();

    await storage.setItem(testKey, testValue);
    const readValue = await storage.getItem(testKey);
    await storage.removeItem(testKey);

    const latency = timer.elapsed();

    if (String(readValue) !== String(testValue)) {
      return {
        status: 'degraded',
        latency,
        message: 'Storage read/write mismatch',
      };
    }

    // get number of items in the storage
    const storageKeys = await storage.keys();

    const storageItems = storageKeys.length;

    return {
      status: 'healthy',
      latency,
      details: {
        driver: storageDriver,
        storageItems: storageItems,
        storageKeys,
      },
    };
  } catch (error) {
    const latency = timer.elapsed();
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.warn('Storage health check failed', {
      error: errorMessage,
      latency,
      driver: storageDriver,
    });

    // Storage is optional - the app can function without KV storage for most operations.
    // Always return 'degraded' rather than 'unhealthy' for storage failures to avoid
    // unnecessary restarts and failed health checks in environments where storage
    // might not be configured (CI, development, etc.)
    return {
      status: 'degraded',
      latency,
      message: `KV storage unavailable: ${errorMessage}`,
      details: {
        driver: storageDriver,
      },
    };
  }
}

/**
 * Check memory usage
 *
 * Uses RSS (Resident Set Size) for health determination rather than heap percentage.
 * Node.js heap starts small (~30MB) and grows dynamically up to ~1.5GB, so
 * heapUsedPercent is misleading for fresh processes.
 *
 * Thresholds are based on typical container limits:
 * - Degraded: RSS > 400MB (warning level)
 * - Unhealthy: RSS > 900MB (approaching typical 1GB container limit)
 */
function checkMemory(): ComponentHealth {
  // Configurable thresholds (in MB) - could be moved to runtime config
  const RSS_DEGRADED_MB = 400;
  const RSS_UNHEALTHY_MB = 900;

  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    const heapUsedPercent = Math.round(
      (memUsage.heapUsed / memUsage.heapTotal) * 100,
    );

    // Use RSS for health determination - it reflects actual memory consumption
    let status: ComponentHealth['status'] = 'healthy';
    let message: string | undefined;

    if (rssMB > RSS_UNHEALTHY_MB) {
      status = 'unhealthy';
      message = `Critical memory pressure (RSS: ${rssMB}MB)`;
    } else if (rssMB > RSS_DEGRADED_MB) {
      status = 'degraded';
      message = `High memory usage (RSS: ${rssMB}MB)`;
    }

    return {
      status,
      message,
      details: {
        heapUsedMB,
        heapTotalMB,
        rssMB,
        heapUsedPercent,
        externalMB: Math.round(memUsage.external / 1024 / 1024),
      },
    };
  } catch {
    return {
      status: 'degraded',
      message: 'Unable to read memory metrics',
    };
  }
}

/**
 * Calculate overall health status based on component checks
 */
function calculateOverallStatus(
  checks: Record<string, ComponentHealth | undefined>,
): HealthResponseMinimal['status'] {
  const statuses = Object.values(checks)
    .filter((check): check is ComponentHealth => check !== undefined)
    .map((check) => check.status);

  if (statuses.includes('unhealthy')) {
    return 'unhealthy';
  }
  if (statuses.includes('degraded')) {
    return 'degraded';
  }
  return 'healthy';
}

export default defineEventHandler(
  async (event): Promise<HealthResponseMinimal | HealthResponseDetailed> => {
    const config = useRuntimeConfig(event);
    const query = getQuery(event);

    // Check if authorized for detailed metrics (secret key provided)
    const providedKey = query.key as string | undefined;
    const isAuthorized =
      !!config.healthCheckSecret &&
      !!providedKey &&
      providedKey === config.healthCheckSecret;

    // Quick mode: Skip storage check for faster response during startup/load balancer checks
    // This is useful for Azure App Service health probes that need fast responses
    const quickMode = query.quick === 'true' || query.quick === '1';

    // Perform health checks in parallel (skip storage in quick mode for faster startup)
    const [storageHealth, memoryHealth] = await Promise.all([
      quickMode
        ? Promise.resolve({ status: 'healthy' as const })
        : checkStorage(event),
      Promise.resolve(checkMemory()),
    ]);

    const checks = {
      storage: storageHealth,
      memory: memoryHealth,
    };

    const overallStatus = calculateOverallStatus(checks);
    const timestamp = new Date().toISOString();

    // Set appropriate status code based on health
    if (overallStatus === 'unhealthy') {
      setResponseStatus(event, 503); // Service Unavailable
    } else if (overallStatus === 'degraded') {
      setResponseStatus(event, 200); // Still return 200 for degraded to not trigger immediate restarts
    }

    // Add cache control headers to prevent caching of health checks
    setResponseHeaders(event, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    // Log health check result (at debug level to avoid noise)
    const requestLogger = event.context.logger;
    if (requestLogger) {
      requestLogger.trackMetric({
        name: 'health_check',
        value: overallStatus === 'healthy' ? 1 : 0,
        unit: 'count',
        dimensions: {
          status: overallStatus,
        },
      });

      // Return minimal response for public requests
      if (!isAuthorized) {
        return {
          status: overallStatus,
          timestamp,
          version: 'next',
        };
      }
    }
    const environment = await getEnvironment(event);
    // Return detailed response for authorized requests
    return {
      status: overallStatus,
      timestamp,
      version: config.public.appVersion as string,
      commitSha: config.public.commitSha as string,
      uptime: Math.round(process.uptime()),
      checks,
      environment,
    };
  },
);
