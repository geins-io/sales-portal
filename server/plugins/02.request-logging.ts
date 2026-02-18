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
import { getHeader } from 'h3';
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
 * Response object type for beforeResponse hook
 */
interface ResponseObject {
  statusCode?: number;
  body?: unknown;
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
  nitroApp.hooks.hook('request', (event: H3Event) => {
    // Start request timer
    const timer = createTimer();

    // Get logging configuration
    const config = useRuntimeConfig(event);
    const verboseRequests = config.logging?.verboseRequests ?? false;

    // Build headers record for parsing correlation ID
    const headers: Record<string, string | string[] | undefined> = {};
    event.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Get or generate correlation ID
    const correlationId =
      parseCorrelationIdFromHeaders(headers) || generateCorrelationId();

    // Create request context
    const context: LogContext = {
      correlationId,
      method: event.method,
      path: event.path,
      tenantId: event.context.tenant?.tenantId,
      hostname: event.context.tenant?.hostname,
      ip: getClientIp(event),
      userAgent: getHeader(event, 'user-agent'),
    };

    // Create request-scoped logger
    const requestLogger = createRequestLogger(correlationId, context);

    // Attach to event context
    event.context.logger = requestLogger;
    event.context.correlationId = correlationId;
    event.context.requestTimer = timer;

    // Log request start (skip excluded paths for reduced noise)
    // Only include headers when verbose logging is enabled
    if (!shouldExcludePath(event.path)) {
      const logContext = verboseRequests
        ? { ...context, headers: sanitizeHeaders(headers) }
        : context;
      requestLogger.info('Request started', logContext);
    }
  });

  // Before response: Log completion
  nitroApp.hooks.hook(
    'beforeResponse',
    (event: H3Event, response: ResponseObject) => {
      // Skip excluded paths
      if (shouldExcludePath(event.path)) {
        return;
      }

      const requestLogger = event.context.logger;
      const timer = event.context.requestTimer;

      if (!requestLogger || !timer) {
        return;
      }

      const duration = timer.elapsed();
      const statusCode = response?.statusCode || 200;

      const context: LogContext = {
        correlationId: event.context.correlationId,
        method: event.method,
        path: event.path,
        statusCode,
        duration,
        tenantId: event.context.tenant?.tenantId,
      };

      // Log based on status code
      if (statusCode >= 500) {
        requestLogger.error(
          `Request failed with ${statusCode}`,
          undefined,
          context,
        );
      } else if (statusCode >= 400) {
        requestLogger.warn(`Request completed with ${statusCode}`, context);
      } else {
        requestLogger.info('Request completed', context);
      }

      // Track request duration metric
      requestLogger.trackMetric({
        name: 'request_duration',
        value: duration,
        unit: 'ms',
        dimensions: {
          path: event.path,
          method: event.method,
          statusCode: String(statusCode),
        },
      });
    },
  );

  // Error handling: Log errors
  nitroApp.hooks.hook('error', (error, { event }) => {
    // Event may be undefined in some error scenarios
    const h3Event = event as H3Event | undefined;

    const requestLogger = h3Event?.context?.logger;
    const timer = h3Event?.context?.requestTimer;
    const duration = timer?.elapsed();

    const context: LogContext = {
      correlationId: h3Event?.context?.correlationId,
      method: h3Event?.method,
      path: h3Event?.path,
      duration,
      tenantId: (h3Event?.context?.tenant as { id?: string })?.id,
    };

    // Use request logger if available, otherwise use default module logger
    const errorLogger = requestLogger || logger;

    // Type assertion for error with additional properties
    const errorWithMeta = error as Error & {
      statusCode?: number;
      data?: unknown;
    };

    errorLogger.error('Request error', errorWithMeta, {
      ...context,
      statusCode: errorWithMeta?.statusCode || 500,
      errorData: errorWithMeta?.data,
    });

    // Track error metric
    errorLogger.trackMetric({
      name: 'request_error',
      value: 1,
      unit: 'count',
      dimensions: {
        path: h3Event?.path || 'unknown',
        errorType: errorWithMeta?.name || 'Error',
      },
    });
  });
});
