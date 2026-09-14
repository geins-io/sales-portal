/**
 * Sentry Server-Side Configuration
 *
 * This file initializes Sentry for server-side error tracking
 * and performance monitoring in the Nuxt server/Nitro runtime.
 *
 * nuxt.config.ts sets autoInjectServerSentry, so the built server entry imports
 * this file itself: run the build with plain `node .output/server/index.mjs`.
 * Adding a --import flag for this file on top of that initialises Sentry twice.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nuxt/
 */
import * as Sentry from '@sentry/nuxt';

// Server-side Sentry must use process.env directly since
// useRuntimeConfig() is not available at initialization time
// DSN is now server-only (NUXT_SENTRY_DSN) to avoid exposing configuration to clients
const dsn = process.env.NUXT_SENTRY_DSN || '';
// SENTRY_ENVIRONMENT names the deployment, NODE_ENV names the build mode, and
// the two do not line up: webApp.bicep maps the `staging` environment to
// NODE_ENV=production, so without this every staging event would arrive tagged
// `production` and be indistinguishable from a real prod incident.
const environment =
  process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const isProduction = environment === 'prod' || environment === 'production';
// Disable console logging if SENTRY_SILENT is set to 'true'
const silent = process.env.SENTRY_SILENT === 'true';

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

    // Only enable debug mode in development, unless silenced
    debug: !silent && !isProduction,

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
