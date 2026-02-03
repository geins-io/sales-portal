/**
 * Client-side Logger
 *
 * Provides unified logging for the Vue frontend with:
 * - Consistent formatting
 * - Log levels (debug, info, warn, error)
 * - Context awareness (route, tenant)
 * - Production-safe (debug/info silenced in prod)
 *
 * @example
 * ```ts
 * import { logger } from '~/utils/logger'
 *
 * logger.debug('Fetching data', { id: 123 })
 * logger.info('User action', { action: 'click' })
 * logger.warn('Deprecated feature used')
 * logger.error('Failed to load', { error })
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_COLORS: Record<LogLevel, string> = {
  debug: 'color: #9CA3AF', // gray
  info: 'color: #3B82F6', // blue
  warn: 'color: #F59E0B', // amber
  error: 'color: #EF4444', // red
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get the minimum log level based on environment
 * - Development: Show all logs (debug+)
 * - Production: Only show warnings and errors
 */
function getMinLevel(): number {
  if (import.meta.dev) {
    return LOG_LEVELS.debug;
  }
  return LOG_LEVELS.warn;
}

/**
 * Format the log prefix with timestamp and level
 */
function formatPrefix(level: LogLevel): string {
  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 12) ?? '';
  return `[${timestamp}] ${level.toUpperCase()}`;
}

/**
 * Create a log function for a specific level
 */
function createLogFn(level: LogLevel) {
  return (message: string, context?: LogContext): void => {
    // Skip if below minimum log level
    if (LOG_LEVELS[level] < getMinLevel()) {
      return;
    }

    const prefix = formatPrefix(level);
    const color = LOG_COLORS[level];
    const consoleFn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.log;

    if (context && Object.keys(context).length > 0) {
      consoleFn(`%c${prefix}`, color, message, context);
    } else {
      consoleFn(`%c${prefix}`, color, message);
    }
  };
}

/**
 * Client-side logger instance
 */
export const logger = {
  /**
   * Debug level - only shown in development
   */
  debug: createLogFn('debug'),

  /**
   * Info level - only shown in development
   */
  info: createLogFn('info'),

  /**
   * Warning level - shown in all environments
   */
  warn: createLogFn('warn'),

  /**
   * Error level - shown in all environments
   */
  error: createLogFn('error'),
};

/**
 * Create a logger with preset context
 *
 * @example
 * ```ts
 * const log = createLogger('ProductList')
 * log.debug('Loading products') // Prefixed with [ProductList]
 * ```
 */
export function createLogger(component: string) {
  const prefix = `[${component}]`;

  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(`${prefix} ${message}`, context),
    info: (message: string, context?: LogContext) =>
      logger.info(`${prefix} ${message}`, context),
    warn: (message: string, context?: LogContext) =>
      logger.warn(`${prefix} ${message}`, context),
    error: (message: string, context?: LogContext) =>
      logger.error(`${prefix} ${message}`, context),
  };
}
