/**
 * Logging utility for the Sales Portal server
 *
 * Provides structured logging with different log levels and
 * context-aware logging for tenant-specific operations.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  tenantId?: string;
  hostname?: string;
  requestId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

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
    const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}:`;
    const contextStr = entry.context
      ? ` [${Object.entries(entry.context)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}]`
      : '';
    const errorStr = entry.error
      ? `\n  Error: ${entry.error.message}${entry.error.stack ? `\n${entry.error.stack}` : ''}`
      : '';
    return `${prefix}${contextStr} ${entry.message}${errorStr}`;
  }
  // JSON format for production (better for log aggregation)
  return JSON.stringify(entry);
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error,
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    error: error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : undefined,
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
 * Logger interface
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
}

/**
 * Create a logger instance
 */
export function createLogger(defaultContext?: LogContext): Logger {
  const mergeContext = (context?: LogContext): LogContext | undefined => {
    if (!defaultContext && !context) return undefined;
    return { ...defaultContext, ...context };
  };

  return {
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
  };
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Create a tenant-scoped logger
 */
export function createTenantLogger(tenantId: string, hostname?: string): Logger {
  return createLogger({ tenantId, hostname });
}
