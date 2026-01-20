/**
 * Health Check Endpoint
 *
 * Provides health status for the Sales Portal with two response levels:
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
  environment: string;
  uptime: number;
  checks: {
    storage?: ComponentHealth;
    memory?: ComponentHealth;
  };
}

/**
 * Check storage connectivity (KV store)
 */
async function checkStorage(): Promise<ComponentHealth> {
  const timer = createTimer();

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

    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    const latency = timer.elapsed();
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.warn('Storage health check failed', {
      error: errorMessage,
      latency,
    });

    return {
      status: 'unhealthy',
      latency,
      message: `Storage check failed: ${errorMessage}`,
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): ComponentHealth {
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    const heapUsedPercent = Math.round(
      (memUsage.heapUsed / memUsage.heapTotal) * 100,
    );

    // Consider memory degraded if heap usage > 85%, unhealthy if > 95%
    let status: ComponentHealth['status'] = 'healthy';
    let message: string | undefined;

    if (heapUsedPercent > 95) {
      status = 'unhealthy';
      message = 'Critical memory pressure';
    } else if (heapUsedPercent > 85) {
      status = 'degraded';
      message = 'High memory usage';
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
    const config = useRuntimeConfig();
    const query = getQuery(event);

    // Check if authorized for detailed metrics (secret key provided)
    const providedKey = query.key as string | undefined;
    const isAuthorized =
      !!config.healthCheckSecret &&
      !!providedKey &&
      providedKey === config.healthCheckSecret;

    // Perform health checks in parallel
    const [storageHealth, memoryHealth] = await Promise.all([
      checkStorage(),
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
    }

    // Return minimal response for public requests
    if (!isAuthorized) {
      return {
        status: overallStatus,
        timestamp,
      };
    }

    // Return detailed response for authorized requests
    return {
      status: overallStatus,
      timestamp,
      version: config.public.appVersion as string,
      environment: config.public.environment as string,
      uptime: Math.round(process.uptime()),
      checks,
    };
  },
);
