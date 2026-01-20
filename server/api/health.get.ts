/**
 * Health Check Endpoint
 *
 * Provides comprehensive health status for the Sales Portal including:
 * - Application status
 * - Storage connectivity (KV/Redis)
 * - Memory usage
 * - Uptime information
 *
 * Used by:
 * - Azure App Service health probes
 * - Load balancers
 * - Monitoring systems
 * - Application Insights availability tests
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
 * Overall health response
 */
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
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

    if (readValue !== testValue) {
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
): HealthResponse['status'] {
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

// Track server start time for uptime calculation
const serverStartTime = Date.now();

export default defineEventHandler(async (event): Promise<HealthResponse> => {
  const config = useRuntimeConfig();

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
  const uptimeSeconds = Math.round((Date.now() - serverStartTime) / 1000);

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: config.public.appVersion as string,
    environment: config.public.environment as string,
    uptime: uptimeSeconds,
    checks,
  };

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

  return response;
});
