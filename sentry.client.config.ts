/**
 * Sentry Client-Side Configuration
 *
 * This file initializes Sentry for browser-side error tracking,
 * performance monitoring, and session replay.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nuxt/
 */
import * as Sentry from '@sentry/nuxt';

const config = useRuntimeConfig();
const dsn = config.public.sentry?.dsn;
const environment = config.public.environment || 'development';
const isProduction = environment === 'production';

// Only initialize Sentry if DSN is provided
if (dsn) {
  Sentry.init({
    dsn,

    // Environment and release information
    environment,

    // Adds request headers and IP for users
    // https://docs.sentry.io/platforms/javascript/guides/nuxt/configuration/options/#sendDefaultPii
    sendDefaultPii: true,

    // Integrations for enhanced functionality
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),

      // Session replay for visual debugging
      Sentry.replayIntegration({
        // Mask all text content for privacy
        maskAllText: false,
        // Block all media for performance
        blockAllMedia: false,
      }),
    ],

    // Performance monitoring
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
    // We recommend adjusting this value in production
    // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Session Replay configuration
    // Capture Replay for 10% of all sessions in production
    // plus for 100% of sessions with an error
    // https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
    replaysSessionSampleRate: isProduction ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,

    // Only enable debug mode in development
    debug: !isProduction && import.meta.dev,

    // Ignore certain errors
    ignoreErrors: [
      // Ignore network errors that are common in web apps
      'Network Error',
      'NetworkError',
      'Failed to fetch',
      'Load failed',
      // Ignore user-initiated navigation cancellations
      'NavigationDuplicated',
      'Redirected when going from',
      // Ignore browser extension errors
      /chrome-extension/,
      /moz-extension/,
    ],

    // Filter out certain URLs from being tracked
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      // Firefox extensions
      /^moz-extension:\/\//i,
    ],

    // Before sending events, filter out sensitive data
    beforeSend(event) {
      // Remove sensitive query parameters
      if (event.request?.query_string) {
        const sensitiveParams = ['token', 'password', 'secret', 'key', 'auth'];
        const params = new URLSearchParams(event.request.query_string);
        sensitiveParams.forEach((param) => {
          if (params.has(param)) {
            params.set(param, '[FILTERED]');
          }
        });
        event.request.query_string = params.toString();
      }
      return event;
    },
  });
}
