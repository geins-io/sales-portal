/**
 * Sentry Client-Side Configuration
 *
 * This file initializes Sentry for browser-side error tracking,
 * performance monitoring, and session replay.
 *
 * Runs only when NUXT_PUBLIC_SENTRY_DSN is set. Azure sets it from the same
 * secret as the server DSN, so browser reporting is on in every deployed
 * environment; locally it is opt-in. A DSN is a write-only ingest key and is
 * public by design — the privacy guards are sendDefaultPii, the replay masking
 * and the beforeSend filtering below, not the DSN's secrecy.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nuxt/
 */
import * as Sentry from '@sentry/nuxt';

const config = useRuntimeConfig();
// Client-side DSN is optional and must be explicitly set via NUXT_PUBLIC_SENTRY_DSN.
// The key is declared in runtimeConfig.public so the env var actually reaches
// the browser — see the note there.
const dsn = config.public.sentry.dsn;
// Falls back to public.environment, which carries NODE_ENV and so cannot tell
// staging from prod. See the matching note in sentry.server.config.ts.
const environment =
  config.public.sentry.environment ||
  config.public.environment ||
  'development';
const isProduction = environment === 'prod' || environment === 'production';
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
