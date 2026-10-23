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
//   Geins GraphQL (SDK)          GEINS_REQUEST_TIMEOUT_MS, below, for every
//                                read and write; a call may ask for its own
//                                limit, which wins
//     CMS reads                  the default and no second attempt, which
//                                would double the wait; a failed menu or
//                                content area serves its last good copy
//                                (services/cms)
//     order and quote writes     none (0): checkout.createOrder in the SDK,
//                                quote accept and reject (services/quotes)
//     configurator calls         15 s, line reads 2 s, reopen 45 s
//                                (services/configurator-merchant-api)
//     the config's channel read  3 s, then the config keeps the last read
//                                asset host, or goes without it and reads
//                                again 30 s later (services/tenant-config)
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

/**
 * The configurator's 2 s line reads: past it, a cart or an order answers
 * without its configurations by design, so the limit is not a failure.
 */
const EXPECTED_TIMEOUTS: ReadonlySet<string> = new Set([
  'getConfiguredCartLines',
  'getConfiguredOrderLineChoices',
]);

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
  if (EXPECTED_TIMEOUTS.has(context.operationName)) return;
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
