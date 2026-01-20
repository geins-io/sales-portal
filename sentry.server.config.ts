/**
 * Sentry Server-Side Configuration
 *
 * This file initializes Sentry for server-side error tracking
 * and performance monitoring in the Nuxt server/Nitro runtime.
 *
 * Note: Server-side monitoring doesn't work in development mode.
 * To test, build the application and run:
 * node --import ./.output/server/sentry.server.config.mjs .output/server/index.mjs
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nuxt/
 */
import * as Sentry from '@sentry/nuxt';

// Server-side Sentry must use process.env directly since
// useRuntimeConfig() is not available at initialization time
const dsn = process.env.NUXT_PUBLIC_SENTRY_DSN || '';
const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

// Only initialize Sentry if DSN is provided
if (dsn) {
  Sentry.init({
    dsn,

    // Environment information
    environment,

    // Performance monitoring
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
    // We recommend adjusting this value in production
    // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Only enable debug mode in development
    debug: !isProduction,

    // Before sending events, filter out sensitive data
    beforeSend(event) {
      // Filter out sensitive headers
      if (event.request?.headers) {
        const sensitiveHeaders = [
          'authorization',
          'cookie',
          'x-api-key',
          'x-auth-token',
        ];
        sensitiveHeaders.forEach((header) => {
          if (event.request?.headers?.[header]) {
            event.request.headers[header] = '[FILTERED]';
          }
        });
      }
      return event;
    },
  });
}
