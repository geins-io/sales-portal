import * as Sentry from '@sentry/nuxt';

/**
 * Sentry Server-side Configuration
 *
 * Initializes Sentry for error tracking and performance monitoring on the server.
 * This configuration is loaded automatically by the @sentry/nuxt module.
 *
 * Note: Server-side Sentry doesn't work in development mode.
 * To enable it, build your application and run with:
 * node --import ./.output/server/sentry.server.config.mjs .output/server/index.mjs
 */

Sentry.init({
  // DSN from environment variable (useRuntimeConfig is not available at server init time)
  dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',

  // Environment tag for organizing errors
  environment: process.env.NODE_ENV || 'development',

  // Release version for tracking deployments
  release: `sales-portal@${process.env.npm_package_version || '1.0.0'}`,

  // Performance Monitoring
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // We recommend adjusting this value in production (e.g., 0.1 for 10%)
  // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable debug mode in development for troubleshooting
  debug: process.env.NODE_ENV === 'development',

  // Filter out certain errors
  beforeSend(event, hint) {
    // Don't send events if DSN is not configured
    if (!process.env.NUXT_PUBLIC_SENTRY_DSN) {
      return null;
    }

    // Filter out health check errors (these are expected and monitored separately)
    const error = hint.originalException as Error;
    if (error?.message?.includes('health check')) {
      return null;
    }

    return event;
  },
});
