import * as Sentry from '@sentry/nuxt';
import type { GeinsErrorContext, GeinsRequestConfig } from '@geins/types';
import { logger } from './logger';

// =============================================================================
// Every outbound call a request can wait on, and how long it may take.
//
// Without a limit, a call that never gets response headers waits for undici's
// default of 300 s, past the App Service gateway's 240 s, and a render held on
// it answers nothing and reports nothing.
//
//   Geins GraphQL (SDK)          GEINS_REQUEST_TIMEOUT_MS, below; a call may
//                                ask for its own limit, which wins
//     configurator calls         15 s, line reads 2 s, reopen 45 s
//                                (services/configurator-merchant-api)
//   Geins auth and REST (SDK)    10 s, set inside the SDK
//   Store-settings lookups       TENANT_LOOKUP_TIMEOUT_MS, below (utils/tenant)
//   /api/external proxy          30 s (api/external)
//   Sentry transport             idle timeout (sentry-transport)
// =============================================================================

/**
 * Production's sampled Geins calls over 30 days: p99 0.5 s, longest 14.2 s.
 * Twelve times below the gateway's 240 s.
 */
export const GEINS_REQUEST_TIMEOUT_MS = 20_000;

/** Measured up to 9.6 s on dev. A lookup past this answers the 503 page. */
export const TENANT_LOOKUP_TIMEOUT_MS = 20_000;

interface GeinsTenant {
  accountName: string;
  channel: string;
  tld: string;
}

/**
 * Logged and sent to Sentry where the timeout happens. A caller that falls
 * back on a failed read would otherwise leave no trace of it. The SDK is
 * shared by every request of a storefront, so the request's correlation id is
 * not known here; the tenant, the operation and the SDK's request id are.
 */
function reportTimeout(context: GeinsErrorContext, tenant: GeinsTenant) {
  const { error } = context;
  if (Reflect.get(error, 'code') !== 'REQUEST_TIMEOUT') return;
  const timeoutMs: unknown = Reflect.get(error, 'timeoutMs');
  logger.error(`[geins] request timed out: ${context.operationName}`, error, {
    tenantId: tenant.accountName,
    channel: `${tenant.channel}|${tenant.tld}`,
    operationName: context.operationName,
    geinsRequestId: context.requestId,
    timeoutMs,
    duration: context.durationMs,
  });
  Sentry.captureException(error, {
    tags: {
      'geins.operation': context.operationName,
      'geins.account': tenant.accountName,
    },
    extra: { geinsRequestId: context.requestId, timeoutMs },
  });
}

/** The SDK's request settings for one storefront. */
export function geinsRequestConfig(tenant: GeinsTenant): GeinsRequestConfig {
  return {
    timeoutMs: GEINS_REQUEST_TIMEOUT_MS,
    interceptors: { onError: (context) => reportTimeout(context, tenant) },
  };
}
