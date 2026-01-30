/**
 * Client-side Error Tracking Composable
 *
 * Provides error tracking and reporting utilities for the Vue frontend.
 * Integrates with Sentry for production error tracking.
 * In development: logs to console with detailed information
 * In production: sends errors to Sentry and server-side logging endpoint
 *
 * Features:
 * - Sentry integration for error tracking
 * - Automatic error boundary integration
 * - User context tracking
 * - Tenant context tracking
 * - Custom error properties
 * - Performance tracking
 */

import { ref, onErrorCaptured, type Ref } from 'vue';
import * as Sentry from '@sentry/nuxt';

/**
 * Error context for tracking
 */
interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  tenantId?: string;
  route?: string;
  [key: string]: unknown;
}

/**
 * Error event sent to tracking endpoint
 */
interface ErrorEvent {
  message: string;
  name: string;
  stack?: string;
  context: ErrorContext;
  timestamp: string;
  url: string;
  userAgent: string;
}

/**
 * Performance metric event
 */
interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  context?: Record<string, string>;
}

/**
 * Error tracking state
 */
interface ErrorTrackingState {
  errors: Ref<ErrorEvent[]>;
  isEnabled: Ref<boolean>;
}

// Global error tracking state (singleton pattern)
let globalState: ErrorTrackingState | null = null;

function getGlobalState(): ErrorTrackingState {
  if (!globalState) {
    globalState = {
      errors: ref<ErrorEvent[]>([]),
      isEnabled: ref(true),
    };
  }
  return globalState;
}

/**
 * Error batching configuration
 */
const BATCH_FLUSH_INTERVAL_MS = 5000; // Flush batch every 5 seconds
const BATCH_MAX_SIZE = 50; // Maximum errors before forcing a flush

/**
 * Error queue for batching
 */
const errorQueue: ErrorEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Send batched errors to server for logging
 */
async function sendBatchToServer(batch: ErrorEvent[]): Promise<void> {
  // Don't send in development or if window is not available
  if (import.meta.dev || typeof window === 'undefined') {
    return;
  }

  if (batch.length === 0) {
    return;
  }

  try {
    await fetch('/api/log/error-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ errors: batch }),
      // Don't wait for response, fire and forget
      keepalive: true,
    });
  } catch {
    // Silently fail - we don't want error tracking to cause more errors
    console.debug('[ErrorTracking] Failed to send error batch to server');
  }
}

/**
 * Flush the error queue, sending all queued errors to the server
 */
function flushErrors(): void {
  if (errorQueue.length === 0) {
    flushTimeout = null;
    return;
  }

  // Extract all errors from queue
  const batch = errorQueue.splice(0, errorQueue.length);

  // Clear timeout reference
  flushTimeout = null;

  // Send batch to server
  sendBatchToServer(batch);
}

/**
 * Queue an error for batched sending to the server
 */
function queueError(error: ErrorEvent): void {
  // Don't queue in development or if window is not available
  if (import.meta.dev || typeof window === 'undefined') {
    return;
  }

  errorQueue.push(error);

  // Force flush if batch is too large
  if (errorQueue.length >= BATCH_MAX_SIZE) {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    flushErrors();
    return;
  }

  // Schedule flush if not already scheduled
  if (!flushTimeout) {
    flushTimeout = setTimeout(flushErrors, BATCH_FLUSH_INTERVAL_MS);
  }
}

/**
 * Send error to server for logging (legacy - kept for backwards compatibility)
 * @deprecated Use queueError instead for batched sending
 */
async function sendErrorToServer(error: ErrorEvent): Promise<void> {
  queueError(error);
}

/**
 * Reset the error queue and clear any pending flush timeout
 * Primarily used for testing purposes
 */
export function _resetErrorQueue(): void {
  errorQueue.splice(0, errorQueue.length);
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}

/**
 * Get the current error queue for testing purposes
 * @internal
 */
export function _getErrorQueue(): ErrorEvent[] {
  return errorQueue;
}

/**
 * Get the current flush timeout status for testing purposes
 * @internal
 */
export function _hasFlushTimeout(): boolean {
  return flushTimeout !== null;
}

/**
 * Format error for logging
 */
function formatError(
  error: Error | unknown,
  context: ErrorContext = {},
): ErrorEvent {
  const err = error instanceof Error ? error : new Error(String(error));

  return {
    message: err.message,
    name: err.name,
    stack: err.stack,
    context: {
      ...context,
      route:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
    },
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

/**
 * Log error to console with formatting
 */
function logErrorToConsole(event: ErrorEvent): void {
  const style = 'color: #ff6b6b; font-weight: bold;';

  console.group('%c[Error Tracking]', style);
  console.error(`${event.name}: ${event.message}`);

  if (Object.keys(event.context).length > 0) {
    console.log('Context:', event.context);
  }

  if (event.stack) {
    console.log('Stack:', event.stack);
  }

  console.groupEnd();
}

/**
 * Main error tracking composable
 */
export function useErrorTracking() {
  const state = getGlobalState();
  const config = useRuntimeConfig();
  const route = useRoute();

  /**
   * Track an error
   */
  function trackError(
    error: Error | unknown,
    context: ErrorContext = {},
  ): void {
    if (!state.isEnabled.value) {
      return;
    }

    const event = formatError(error, {
      ...context,
      route: route.path,
    });

    // Add to local state (limited to last 50 errors)
    state.errors.value = [event, ...state.errors.value.slice(0, 49)];

    // Log to console in development
    if (import.meta.dev) {
      logErrorToConsole(event);
    }

    // Send to Sentry
    const err = error instanceof Error ? error : new Error(String(error));
    Sentry.captureException(err, {
      tags: {
        component: context.component,
        action: context.action,
      },
      extra: context,
    });

    // Send to server in production (as backup/additional logging)
    sendErrorToServer(event);
  }

  /**
   * Set user context for Sentry tracking
   */
  function setUser(
    user: { id: string; email?: string; username?: string } | null,
  ): void {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    } else {
      Sentry.setUser(null);
    }
  }

  /**
   * Set tenant context for Sentry tracking
   */
  function setTenant(tenant: { id: string; name?: string } | null): void {
    if (tenant) {
      Sentry.setTag('tenant.id', tenant.id);
      if (tenant.name) {
        Sentry.setTag('tenant.name', tenant.name);
      }
    } else {
      Sentry.setTag('tenant.id', undefined);
      Sentry.setTag('tenant.name', undefined);
    }
  }

  /**
   * Add a breadcrumb for debugging context
   */
  function addBreadcrumb(
    message: string,
    category: string = 'app',
    data?: Record<string, unknown>,
  ): void {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }

  /**
   * Track a warning (non-fatal)
   */
  function trackWarning(message: string, context: ErrorContext = {}): void {
    if (!state.isEnabled.value) {
      return;
    }

    // Format the warning context for logging
    const warningContext = {
      ...context,
      severity: 'warning' as const,
      route: route.path,
    };

    if (import.meta.dev) {
      console.warn('[ErrorTracking] Warning:', message, warningContext);
    }

    // In production, warnings could be sent to monitoring (future enhancement)
    // For now, warnings are only logged in development mode
  }

  /**
   * Track a custom event for analytics
   */
  function trackEvent(
    name: string,
    properties: Record<string, unknown> = {},
  ): void {
    if (!state.isEnabled.value) {
      return;
    }

    if (import.meta.dev) {
      console.log('[ErrorTracking] Event:', name, properties);
    }

    // In production, this could be sent to analytics
    if (!import.meta.dev && config.public.features?.analytics) {
      // Future: integrate with analytics provider
    }
  }

  /**
   * Track a performance metric
   */
  function trackMetric(metric: PerformanceMetric): void {
    if (!state.isEnabled.value) {
      return;
    }

    if (import.meta.dev) {
      console.log(
        '[ErrorTracking] Metric:',
        metric.name,
        `${metric.value}${metric.unit}`,
      );
    }

    // In production, metrics could be sent to monitoring
  }

  /**
   * Create a timer for performance tracking
   */
  function startTimer(name: string): { stop: () => number } {
    const start = performance.now();

    return {
      stop: () => {
        const duration = Math.round(performance.now() - start);
        trackMetric({ name, value: duration, unit: 'ms' });
        return duration;
      },
    };
  }

  /**
   * Enable/disable error tracking
   */
  function setEnabled(enabled: boolean): void {
    state.isEnabled.value = enabled;
  }

  /**
   * Clear tracked errors
   */
  function clearErrors(): void {
    state.errors.value = [];
  }

  /**
   * Get recent errors (for debugging UI)
   */
  function getRecentErrors(): ErrorEvent[] {
    return state.errors.value;
  }

  /**
   * Immediately flush any queued errors to the server
   * Useful for page unload or critical error scenarios
   */
  function flushErrorQueue(): void {
    flushErrors();
  }

  /**
   * Get the current number of queued errors
   * Useful for debugging and testing
   */
  function getQueuedErrorCount(): number {
    return errorQueue.length;
  }

  return {
    trackError,
    trackWarning,
    trackEvent,
    trackMetric,
    startTimer,
    setEnabled,
    clearErrors,
    getRecentErrors,
    setUser,
    setTenant,
    addBreadcrumb,
    flushErrorQueue,
    getQueuedErrorCount,
    errors: state.errors,
    isEnabled: state.isEnabled,
  };
}

/**
 * Vue error boundary composable
 *
 * Use in a component to capture errors from child components
 *
 * @example
 * ```vue
 * <script setup>
 * const { error, clearError } = useErrorBoundary();
 * </script>
 *
 * <template>
 *   <div v-if="error">
 *     <p>Something went wrong</p>
 *     <button @click="clearError">Retry</button>
 *   </div>
 *   <slot v-else />
 * </template>
 * ```
 */
export function useErrorBoundary(context: ErrorContext = {}) {
  const error = ref<Error | null>(null);
  const { trackError } = useErrorTracking();

  onErrorCaptured((err, instance, info) => {
    error.value = err;

    trackError(err, {
      ...context,
      component: instance?.$options?.name || 'Unknown',
      errorInfo: info,
    });

    // Return false to prevent the error from propagating further
    return false;
  });

  function clearError(): void {
    error.value = null;
  }

  return {
    error,
    clearError,
  };
}

/**
 * Utility to wrap async operations with error tracking
 *
 * @example
 * ```ts
 * const result = await withErrorTracking(
 *   () => fetchUserData(),
 *   { action: 'fetchUserData' }
 * );
 * ```
 */
export async function withErrorTracking<T>(
  operation: () => Promise<T>,
  context: ErrorContext = {},
): Promise<T> {
  const { trackError, startTimer } = useErrorTracking();
  const timer = startTimer(context.action || 'operation');

  try {
    const result = await operation();
    timer.stop();
    return result;
  } catch (error) {
    timer.stop();
    trackError(error, context);
    throw error;
  }
}
