/**
 * Request Logging Plugin
 *
 * Provides comprehensive request/response logging with:
 * - Correlation ID tracking for distributed tracing
 * - Request timing and performance metrics
 * - Tenant context awareness
 * - Error tracking and reporting
 *
 * This plugin integrates with Azure Application Insights through
 * structured JSON logging when running in production.
 */

import type { H3Event } from 'h3';
import {
  createRequestLogger,
  generateCorrelationId,
  parseCorrelationIdFromHeaders,
  createTimer,
  logger,
  type Logger,
  type LogContext,
} from '../utils/logger';
import { getClientIp } from '../utils/rate-limiter';

// Extend H3 event context to include logger
declare module 'h3' {
  interface H3EventContext {
    logger: Logger;
    correlationId: string;
    requestTimer: { elapsed: () => number };
  }
}

/**
 * Paths to exclude from detailed logging (health checks, static assets, etc.)
 */
const EXCLUDED_PATHS = [
  '/api/health',
  '/_nuxt/',
  '/favicon.ico',
  '/robots.txt',
];

/**
 * Check if a path should be excluded from logging
 */
function shouldExcludePath(path: string): boolean {
  return EXCLUDED_PATHS.some((excluded) => path.startsWith(excluded));
}

/**
 * Sanitize headers for logging (remove sensitive data)
 */
function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'set-cookie',
  ];

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (value) {
      sanitized[key] = Array.isArray(value) ? value.join(', ') : value;
    }
  }

  return sanitized;
}

export default defineNitroPlugin((nitroApp) => {
  // Request start: Initialize logging context
  nitroApp.hooks.hook('request', (event) => {
    const h3Event = event as unknown as {
      path: string;
      method: string;
      node: {
        req: {
          headers: Record<string, string | string[] | undefined>;
          socket?: { remoteAddress?: string };
        };
      };
      context: {
        tenant?: { id: string; hostname: string };
        logger?: Logger;
        correlationId?: string;
        requestTimer?: { elapsed: () => number };
      };
    };

    // Start request timer
    const timer = createTimer();

    // Get or generate correlation ID
    const correlationId =
      parseCorrelationIdFromHeaders(h3Event.node.req.headers) ||
      generateCorrelationId();

    // Create request context
    const context: LogContext = {
      correlationId,
      method: h3Event.method,
      path: h3Event.path,
      tenantId: h3Event.context.tenant?.id,
      hostname: h3Event.context.tenant?.hostname,
      ip: getClientIp(event as unknown as H3Event),
      userAgent: h3Event.node.req.headers['user-agent'] as string | undefined,
    };

    // Create request-scoped logger
    const requestLogger = createRequestLogger(correlationId, context);

    // Attach to event context
    h3Event.context.logger = requestLogger;
    h3Event.context.correlationId = correlationId;
    h3Event.context.requestTimer = timer;

    // Log request start (skip excluded paths for reduced noise)
    if (!shouldExcludePath(h3Event.path)) {
      requestLogger.info('Request started', {
        ...context,
        headers: sanitizeHeaders(h3Event.node.req.headers),
      });
    }
  });

  // Before response: Log completion
  nitroApp.hooks.hook('beforeResponse', (event, response) => {
    const h3Event = event as unknown as {
      path: string;
      method: string;
      context: {
        logger?: Logger;
        correlationId?: string;
        requestTimer?: { elapsed: () => number };
        tenant?: { id: string; hostname: string };
      };
    };

    const responseObj = response as { statusCode?: number; body?: unknown };

    // Skip excluded paths
    if (shouldExcludePath(h3Event.path)) {
      return;
    }

    const logger = h3Event.context.logger;
    const timer = h3Event.context.requestTimer;

    if (!logger || !timer) {
      return;
    }

    const duration = timer.elapsed();
    const statusCode = responseObj?.statusCode || 200;

    const context: LogContext = {
      correlationId: h3Event.context.correlationId,
      method: h3Event.method,
      path: h3Event.path,
      statusCode,
      duration,
      tenantId: h3Event.context.tenant?.id,
    };

    // Log based on status code
    if (statusCode >= 500) {
      logger.error(`Request failed with ${statusCode}`, undefined, context);
    } else if (statusCode >= 400) {
      logger.warn(`Request completed with ${statusCode}`, context);
    } else {
      logger.info('Request completed', context);
    }

    // Track request duration metric
    logger.trackMetric({
      name: 'request_duration',
      value: duration,
      unit: 'ms',
      dimensions: {
        path: h3Event.path,
        method: h3Event.method,
        statusCode: String(statusCode),
      },
    });
  });

  // Error handling: Log errors
  nitroApp.hooks.hook('error', (error, { event }) => {
    const h3Event = event as unknown as {
      path?: string;
      method?: string;
      context?: {
        logger?: Logger;
        correlationId?: string;
        requestTimer?: { elapsed: () => number };
        tenant?: { id: string; hostname: string };
      };
    };

    const requestLogger = h3Event?.context?.logger;
    const timer = h3Event?.context?.requestTimer;
    const duration = timer?.elapsed();

    const context: LogContext = {
      correlationId: h3Event?.context?.correlationId,
      method: h3Event?.method,
      path: h3Event?.path,
      duration,
      tenantId: h3Event?.context?.tenant?.id,
    };

    // Use request logger if available, otherwise use default module logger
    const errorLogger = requestLogger || logger;

    const errorObj = error as Error & { statusCode?: number; data?: unknown };

    errorLogger.error('Request error', errorObj, {
      ...context,
      statusCode: errorObj?.statusCode || 500,
      errorData: errorObj?.data,
    });

    // Track error metric
    errorLogger.trackMetric({
      name: 'request_error',
      value: 1,
      unit: 'count',
      dimensions: {
        path: h3Event?.path || 'unknown',
        errorType: errorObj?.name || 'Error',
      },
    });
  });
});
