/**
 * Sentry Client-Side Configuration
 *
 * This file initializes Sentry for browser-side error tracking,
 * performance monitoring, and session replay.
 *
 * NOTE: Client-side Sentry is DISABLED by default for security hardening.
 * The Sentry DSN is now stored in server-only runtime config (NUXT_SENTRY_DSN).
 *
 * If you need client-side error tracking, you can optionally set
 * NUXT_PUBLIC_SENTRY_DSN to enable browser error reporting.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nuxt/
 */
import * as Sentry from '@sentry/nuxt';

const config = useRuntimeConfig();
// Client-side DSN is optional and must be explicitly set via NUXT_PUBLIC_SENTRY_DSN.
// Not declared in runtimeConfig.public (server-only by default), so Nuxt auto-creates
// the nested object from the env var. Access via index signature to avoid `as any`.
const dsn = (
  config.public as Record<string, Record<string, string> | undefined>
).sentry?.dsn;
const environment = config.public.environment || 'development';
const isProduction = environment === 'production';
// Disable Sentry debug logging in the browser
// Set to true only when actively debugging Sentry integration issues
const debug = false;

// Only initialize Sentry if DSN is provided
if (dsn) {
  Sentry.init({
    dsn,

    // Environment and release information
    environment,

    // GDPR: do not send IP addresses or request headers to Sentry
    sendDefaultPii: false,

    // Integrations for enhanced functionality
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),

      // Session replay for visual debugging
      Sentry.replayIntegration({
        // GDPR: mask text and block media in session replays
        maskAllText: true,
        blockAllMedia: true,
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

    // Enable debug mode only when actively debugging Sentry issues
    debug,

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
