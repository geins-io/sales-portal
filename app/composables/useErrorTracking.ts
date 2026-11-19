/**
 * Client-side Error Tracking Composable
 *
 * Reports errors to Sentry and to the console logger, and sets the Sentry
 * user, tenant and breadcrumb context.
 *
 * Holds no module-level state: on the server this module is shared by every
 * SSR request, and ErrorBoundary calls trackError during SSR too.
 */

import { ref, onErrorCaptured } from 'vue';
import * as Sentry from '@sentry/nuxt';
import { createLogger } from '~/utils/logger';

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
 * Performance metric event
 */
interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  context?: Record<string, string>;
}

const log = createLogger('ErrorTracking');

/**
 * Main error tracking composable
 */
export function useErrorTracking() {
  const route = useRoute();

  /**
   * Track an error
   */
  function trackError(
    error: Error | unknown,
    context: ErrorContext = {},
  ): void {
    const err = error instanceof Error ? error : new Error(String(error));

    // Log to console (logger silences debug/info in production)
    log.error(`${err.name}: ${err.message}`, {
      ...context,
      route: route.path,
      ...(err.stack ? { stack: err.stack } : {}),
    });

    Sentry.captureException(err, {
      tags: {
        component: context.component,
        action: context.action,
      },
      extra: context,
    });
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
    // Format the warning context for logging
    const warningContext = {
      ...context,
      severity: 'warning' as const,
      route: route.path,
    };

    log.warn(message, warningContext);
  }

  /**
   * Track a custom event for analytics
   */
  function trackEvent(
    name: string,
    properties: Record<string, unknown> = {},
  ): void {
    log.debug(`Event: ${name}`, properties as Record<string, unknown>);
  }

  /**
   * Track a performance metric
   */
  function trackMetric(metric: PerformanceMetric): void {
    log.debug(`Metric: ${metric.name} ${metric.value}${metric.unit}`);
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

  return {
    trackError,
    trackWarning,
    trackEvent,
    trackMetric,
    startTimer,
    setUser,
    setTenant,
    addBreadcrumb,
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
    // Let Nuxt fatal errors (404, 500) propagate to error.vue
    if (
      err &&
      typeof err === 'object' &&
      'fatal' in err &&
      (err as Record<string, unknown>).fatal
    ) {
      return;
    }

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
