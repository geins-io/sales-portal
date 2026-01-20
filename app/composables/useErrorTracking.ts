/**
 * Client-side Error Tracking Composable
 *
 * Provides error tracking and reporting utilities for the Vue frontend.
 * Integrates with Sentry for comprehensive error monitoring.
 * In development: logs to console with detailed information
 * In production: sends errors to Sentry and server-side logging endpoint
 *
 * Features:
 * - Sentry integration for error tracking
 * - Automatic error boundary integration
 * - User context tracking
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
 * Send error to server for logging
 */
async function sendErrorToServer(error: ErrorEvent): Promise<void> {
  // Don't send in development or if window is not available
  if (import.meta.dev || typeof window === 'undefined') {
    return;
  }

  try {
    await fetch('/api/log/error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(error),
      // Don't wait for response, fire and forget
      keepalive: true,
    });
  } catch {
    // Silently fail - we don't want error tracking to cause more errors
    console.debug('[ErrorTracking] Failed to send error to server');
  }
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
    Sentry.withScope((scope) => {
      // Set context tags
      if (context.component) {
        scope.setTag('component', context.component);
      }
      if (context.action) {
        scope.setTag('action', context.action);
      }
      if (context.tenantId) {
        scope.setTag('tenant_id', context.tenantId);
      }
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }

      // Set extra context
      scope.setExtras({
        route: route.path,
        ...context,
      });

      Sentry.captureException(err);
    });

    // Send to server in production (legacy endpoint)
    sendErrorToServer(event);
  }

  /**
   * Track a warning (non-fatal)
   */
  function trackWarning(message: string, context: ErrorContext = {}): void {
    if (!state.isEnabled.value) {
      return;
    }

    // Format the warning (could be used for future logging)
    const _warningContext = {
      ...context,
      severity: 'warning',
      route: route.path,
    };

    if (import.meta.dev) {
      console.warn('[ErrorTracking] Warning:', message, _warningContext);
    }

    // Warnings are logged but not sent to server by default
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

    // Add breadcrumb to Sentry for event context
    Sentry.addBreadcrumb({
      category: 'user-action',
      message: name,
      level: 'info',
      data: properties,
    });

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
   * Set user context for Sentry error tracking
   * Call this when a user logs in to associate errors with the user
   */
  function setUser(user: {
    id: string;
    email?: string;
    username?: string;
    [key: string]: unknown;
  } | null): void {
    if (user) {
      Sentry.setUser(user);
    } else {
      Sentry.setUser(null);
    }
  }

  /**
   * Set tenant context for multi-tenant error tracking
   * Call this when tenant context is established
   */
  function setTenant(tenantId: string | null): void {
    if (tenantId) {
      Sentry.setTag('tenant_id', tenantId);
    }
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
