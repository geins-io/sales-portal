/**
 * Logging utility for the Sales Portal server
 *
 * Provides structured logging with different log levels,
 * correlation ID tracking for request tracing,
 * and context-aware logging for tenant-specific operations.
 *
 * In production, logs are formatted as JSON for easy parsing by
 * Azure Application Insights and other log aggregation systems.
 */

import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Context information for log entries
 */
export interface LogContext {
  tenantId?: string;
  hostname?: string;
  requestId?: string;
  correlationId?: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ip?: string;
  [key: string]: unknown;
}

/**
 * Structured log entry format
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metrics?: Record<string, number>;
  // Application Insights specific fields
  severityLevel?: number;
  properties?: Record<string, unknown>;
}

/**
 * Metric types for tracking
 */
export interface MetricData {
  name: string;
  value: number;
  unit?: 'ms' | 'bytes' | 'count' | 'percent';
  dimensions?: Record<string, string>;
}

/**
 * Severity levels for Application Insights
 * https://docs.microsoft.com/en-us/azure/azure-monitor/app/api-custom-events-metrics
 */
const AI_SEVERITY_LEVELS: Record<LogLevel, number> = {
  debug: 0, // Verbose
  info: 1, // Information
  warn: 2, // Warning
  error: 3, // Error (4 = Critical, but we use 3 for general errors)
};

/**
 * Get the current log level from environment
 */
function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
    return level as LogLevel;
  }
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

/**
 * Format a log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'development') {
    // Human-readable format for development
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    const color = levelColors[entry.level];

    const prefix = `${color}[${entry.timestamp}] ${entry.level.toUpperCase()}${reset}:`;

    const contextParts: string[] = [];
    if (entry.correlationId) {
      contextParts.push(`cid=${entry.correlationId.slice(0, 8)}`);
    }
    if (entry.context?.tenantId) {
      contextParts.push(`tenant=${entry.context.tenantId}`);
    }
    if (entry.context?.method && entry.context?.path) {
      contextParts.push(`${entry.context.method} ${entry.context.path}`);
    }
    if (entry.context?.statusCode) {
      contextParts.push(`status=${entry.context.statusCode}`);
    }
    if (entry.context?.duration !== undefined) {
      contextParts.push(`${entry.context.duration}ms`);
    }

    const contextStr =
      contextParts.length > 0 ? ` [${contextParts.join(' | ')}]` : '';

    const errorStr = entry.error
      ? `\n  ${color}Error: ${entry.error.message}${reset}${entry.error.stack ? `\n${entry.error.stack}` : ''}`
      : '';

    const metricsStr =
      entry.metrics && Object.keys(entry.metrics).length > 0
        ? `\n  Metrics: ${JSON.stringify(entry.metrics)}`
        : '';

    return `${prefix}${contextStr} ${entry.message}${errorStr}${metricsStr}`;
  }

  // JSON format for production (optimized for Application Insights and log aggregation)
  const output: Record<string, unknown> = {
    timestamp: entry.timestamp,
    level: entry.level,
    severityLevel: AI_SEVERITY_LEVELS[entry.level],
    message: entry.message,
  };

  if (entry.correlationId) {
    output.correlationId = entry.correlationId;
    output['operation_Id'] = entry.correlationId; // Application Insights format
  }

  if (entry.context) {
    output.properties = { ...entry.context };
    // Map to Application Insights custom dimensions
    if (entry.context.tenantId) {
      output['customDimensions'] = { tenantId: entry.context.tenantId };
    }
  }

  if (entry.error) {
    output.exception = entry.error;
    output['exception_type'] = entry.error.name;
    output['exception_message'] = entry.error.message;
  }

  if (entry.metrics) {
    output.metrics = entry.metrics;
  }

  return JSON.stringify(output);
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error,
  metrics?: Record<string, number>,
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId: context?.correlationId,
    context,
    error: error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as Error & { code?: string }).code,
        }
      : undefined,
    metrics,
    severityLevel: AI_SEVERITY_LEVELS[level],
  };
}

/**
 * Output a log entry
 */
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);
  switch (entry.level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Logger interface with metric tracking support
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  trackMetric(metric: MetricData): void;
  trackEvent(name: string, properties?: Record<string, unknown>): void;
  trackDependency(
    name: string,
    target: string,
    duration: number,
    success: boolean,
    context?: LogContext,
  ): void;
  child(context: LogContext): Logger;
  getCorrelationId(): string | undefined;
}

/**
 * Create a logger instance with optional default context
 */
export function createLogger(defaultContext?: LogContext): Logger {
  const mergeContext = (context?: LogContext): LogContext | undefined => {
    if (!defaultContext && !context) return undefined;
    return { ...defaultContext, ...context };
  };

  const instance: Logger = {
    debug(message: string, context?: LogContext): void {
      if (shouldLog('debug')) {
        outputLog(createLogEntry('debug', message, mergeContext(context)));
      }
    },

    info(message: string, context?: LogContext): void {
      if (shouldLog('info')) {
        outputLog(createLogEntry('info', message, mergeContext(context)));
      }
    },

    warn(message: string, context?: LogContext): void {
      if (shouldLog('warn')) {
        outputLog(createLogEntry('warn', message, mergeContext(context)));
      }
    },

    error(message: string, error?: Error, context?: LogContext): void {
      if (shouldLog('error')) {
        outputLog(
          createLogEntry('error', message, mergeContext(context), error),
        );
      }
    },

    /**
     * Track a custom metric (useful for Application Insights custom metrics)
     */
    trackMetric(metric: MetricData): void {
      if (shouldLog('debug')) {
        const context = mergeContext({ metricName: metric.name });
        outputLog(
          createLogEntry(
            'debug',
            `Metric: ${metric.name}`,
            context,
            undefined,
            { [metric.name]: metric.value },
          ),
        );
      }
    },

    /**
     * Track a custom event for analytics
     */
    trackEvent(name: string, properties?: Record<string, unknown>): void {
      if (shouldLog('info')) {
        const context = mergeContext({ eventName: name, ...properties });
        outputLog(createLogEntry('info', `Event: ${name}`, context));
      }
    },

    /**
     * Track an external dependency call (API, database, etc.)
     */
    trackDependency(
      name: string,
      target: string,
      duration: number,
      success: boolean,
      context?: LogContext,
    ): void {
      const level = success ? 'debug' : 'warn';
      if (shouldLog(level)) {
        const depContext = mergeContext({
          ...context,
          dependencyName: name,
          dependencyTarget: target,
          dependencyDuration: duration,
          dependencySuccess: success,
        });
        outputLog(
          createLogEntry(
            level,
            `Dependency: ${name} -> ${target}`,
            depContext,
            undefined,
            {
              [`dependency_${name}_duration`]: duration,
            },
          ),
        );
      }
    },

    /**
     * Create a child logger with additional context
     */
    child(context: LogContext): Logger {
      return createLogger(mergeContext(context));
    },

    /**
     * Get the correlation ID from the default context
     */
    getCorrelationId(): string | undefined {
      return defaultContext?.correlationId;
    },
  };

  return instance;
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Create a tenant-scoped logger
 */
export function createTenantLogger(
  tenantId: string,
  hostname?: string,
): Logger {
  return createLogger({ tenantId, hostname });
}

/**
 * Create a request-scoped logger with correlation ID
 */
export function createRequestLogger(
  correlationId?: string,
  context?: Omit<LogContext, 'correlationId'>,
): Logger {
  const cid = correlationId || generateCorrelationId();
  return createLogger({ correlationId: cid, ...context });
}

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Parse correlation ID from request headers
 * Supports common correlation ID header formats
 */
export function parseCorrelationIdFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  // Common correlation ID headers in order of preference
  const correlationHeaders = [
    'x-correlation-id',
    'x-request-id',
    'request-id',
    'traceparent', // W3C Trace Context
    'x-trace-id',
  ];

  for (const header of correlationHeaders) {
    const value = headers[header];
    if (value) {
      // Handle traceparent format: version-traceid-parentid-flags
      if (header === 'traceparent' && typeof value === 'string') {
        const parts = value.split('-');
        if (parts.length >= 2) {
          return parts[1]; // Return the trace ID part
        }
      }
      return Array.isArray(value) ? value[0] : value;
    }
  }

  return undefined;
}

/**
 * Create a timer for tracking operation duration
 */
export function createTimer(): { elapsed: () => number } {
  const start = performance.now();
  return {
    elapsed: () => Math.round(performance.now() - start),
  };
}

/**
 * Utility to safely stringify objects for logging
 */
export function safeStringify(obj: unknown, maxLength = 1000): string {
  try {
    const str = JSON.stringify(obj);
    if (str.length > maxLength) {
      return str.slice(0, maxLength) + '... [truncated]';
    }
    return str;
  } catch {
    return '[Unable to stringify]';
  }
}
