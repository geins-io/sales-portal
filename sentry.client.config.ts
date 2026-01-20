import * as Sentry from '@sentry/nuxt';

/**
 * Sentry Client-side Configuration
 *
 * Initializes Sentry for error tracking and performance monitoring in the browser.
 * This configuration is loaded automatically by the @sentry/nuxt module.
 */

const config = useRuntimeConfig();

// Build integrations list dynamically based on availability
// Some integrations may not be available in test environments
const integrations: Sentry.Integration[] = [];

// Browser tracing for performance monitoring
if (typeof Sentry.browserTracingIntegration === 'function') {
  integrations.push(Sentry.browserTracingIntegration());
}

// Session Replay for visual debugging of user sessions
if (typeof Sentry.replayIntegration === 'function') {
  integrations.push(
    Sentry.replayIntegration({
      // Mask all text content by default for privacy
      maskAllText: false,
      // Block all media (images, videos) by default
      blockAllMedia: false,
    }),
  );
}

Sentry.init({
  // DSN from runtime config (set via NUXT_PUBLIC_SENTRY_DSN environment variable)
  dsn: config.public.sentry.dsn,

  // Adds request headers and IP for users
  // https://docs.sentry.io/platforms/javascript/guides/nuxt/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Environment tag for organizing errors
  environment: config.public.environment || 'development',

  // Release version for tracking deployments
  release: `sales-portal@${config.public.appVersion}`,

  // Integrations for enhanced functionality
  integrations,

  // Performance Monitoring
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // We recommend adjusting this value in production (e.g., 0.1 for 10%)
  // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
  tracesSampleRate: config.public.environment === 'production' ? 0.1 : 1.0,

  // Session Replay
  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error
  // https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
  replaysSessionSampleRate:
    config.public.environment === 'production' ? 0.1 : 0,
  replaysOnErrorSampleRate: 1.0,

  // Enable debug mode in development for troubleshooting
  debug: config.public.environment === 'development',

  // Filter out certain errors
  beforeSend(event, hint) {
    // Don't send events if DSN is not configured
    if (!config.public.sentry.dsn) {
      return null;
    }

    // Filter out common browser extension errors
    const error = hint.originalException as Error;
    if (error?.message) {
      // Ignore ResizeObserver loop errors (common false positive)
      if (error.message.includes('ResizeObserver loop')) {
        return null;
      }
      // Ignore third-party script errors
      if (
        error.message.includes('Script error') ||
        error.message.includes('Non-Error')
      ) {
        return null;
      }
    }

    return event;
  },
});
