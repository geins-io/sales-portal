import { GeinsCore } from '@geins/core';
import { GeinsCRM } from '@geins/crm';
import { GeinsCMS } from '@geins/cms';
import { GeinsOMS } from '@geins/oms';
import { RuntimeContext } from '@geins/types';
import type { GeinsSettings as SdkGeinsSettings } from '@geins/types';
import type { H3Event } from 'h3';
import type { GeinsSettings as TenantGeinsSettings } from '#shared/types/tenant-config';

export interface TenantSDK {
  core: GeinsCore;
  crm: GeinsCRM;
  cms: GeinsCMS;
  oms: GeinsOMS;
}

/**
 * Maps our tenant environment values to SDK environment values.
 * Our config uses 'production'/'staging', SDK expects 'prod'/'qa'/'dev'.
 */
function mapEnvironment(
  env?: TenantGeinsSettings['environment'],
): SdkGeinsSettings['environment'] {
  switch (env) {
    case 'staging':
      return 'qa';
    case 'production':
    default:
      return 'prod';
  }
}

/** Per-tenant singleton cache. Same tenant reuses the same SDK instance. */
const tenants = new Map<string, TenantSDK>();

/**
 * Clears cached SDK instances for a tenant.
 * Called by the webhook handler on config invalidation so the next request
 * creates a fresh SDK with up-to-date geinsSettings.
 */
export function clearSdkCache(tenantId: string): void {
  const target = tenants.get(tenantId);
  if (!target) {
    // Try direct delete in case only hostname key exists
    tenants.delete(tenantId);
    return;
  }
  // Remove all keys pointing to the same SDK instance (tenantId + hostname aliases)
  const keysToDelete: string[] = [];
  for (const [key, sdk] of tenants) {
    if (sdk === target) keysToDelete.push(key);
  }
  for (const key of keysToDelete) tenants.delete(key);
}

/**
 * Creates a Geins SDK instance from tenant Geins settings.
 */
export function createTenantSDK(geinsSettings: TenantGeinsSettings): TenantSDK {
  const sdkSettings: SdkGeinsSettings = {
    apiKey: geinsSettings.apiKey,
    accountName: geinsSettings.accountName,
    channel: geinsSettings.channel,
    tld: geinsSettings.tld,
    locale: geinsSettings.locale,
    market: geinsSettings.market,
    environment: mapEnvironment(geinsSettings.environment),
  };

  const core = new GeinsCore(sdkSettings);
  const crm = new GeinsCRM(core, { clientConnectionMode: 'Direct' });
  const cms = new GeinsCMS(core);
  const oms = new GeinsOMS(core, {
    omsSettings: { context: RuntimeContext.SERVER },
  });

  return { core, crm, cms, oms };
}

/**
 * Extracts channel context variables from a TenantSDK for raw GraphQL queries.
 * All Geins GraphQL queries accept optional channelId, languageId, marketId.
 *
 * @param sdk - The tenant SDK instance
 * @param localeOverride - Optional locale to use instead of the SDK default.
 *   Pass the user's i18n locale (from `getRequestLocale()`) to keep
 *   GraphQL queries in sync with the UI language.
 * @param marketOverride - Optional market to use instead of the SDK default.
 *   Pass the user's market preference (from `getRequestMarket()`) to keep
 *   GraphQL queries in sync with the selected market.
 */
export function getChannelVariables(
  sdk: TenantSDK,
  localeOverride?: string,
  marketOverride?: string,
): {
  channelId: string;
  languageId: string;
  marketId: string;
} {
  const settings = sdk.core.geinsSettings;
  return {
    channelId: settings.channel,
    languageId: localeOverride ?? settings.locale,
    marketId: marketOverride ?? settings.market,
  };
}

/**
 * Composes getChannelVariables with request-level locale and market cookies.
 * Use this in service functions to automatically pipe the user's preferences
 * into GraphQL queries.
 */
export function getRequestChannelVariables(
  sdk: TenantSDK,
  event: H3Event,
): {
  channelId: string;
  languageId: string;
  marketId: string;
} {
  return getChannelVariables(
    sdk,
    getRequestLocale(event),
    getRequestMarket(event),
  );
}

/**
 * Returns a per-tenant singleton Geins SDK instance.
 * Same tenant reuses the same instance across requests — the stateless SDK
 * (NO_CACHE fetch policy, per-operation tokens) makes this safe.
 * Different tenants get different instances (isolated by tenantId).
 * Multiple hostnames for the same tenant share one SDK instance.
 */
export async function getTenantSDK(event: H3Event): Promise<TenantSDK> {
  const hostname = event.context.tenant?.hostname;
  if (!hostname) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'No tenant context on request');
  }

  // Use tenantId for cache key (falls back to hostname for API routes
  // where tenantId may not be resolved yet)
  const cacheKey = event.context.tenant.tenantId || hostname;

  const cached = tenants.get(cacheKey);
  if (cached) {
    return cached;
  }

  const tenant = await resolveTenant(hostname, event);
  if (!tenant?.geinsSettings) {
    throw createAppError(
      ErrorCode.BAD_REQUEST,
      'Tenant has no Geins SDK configuration',
    );
  }

  // Check again with the resolved tenantId — another hostname for
  // the same tenant may have already created the SDK instance
  const tid = tenant.tenantId || hostname;
  const existing = tenants.get(tid);
  if (existing) {
    // Also cache under the current lookup key for fast path next time
    if (cacheKey !== tid) tenants.set(cacheKey, existing);
    return existing;
  }

  const sdk = createTenantSDK(tenant.geinsSettings);
  // Cache under both tenantId and the lookup key (hostname or tenantId)
  tenants.set(tid, sdk);
  if (cacheKey !== tid) tenants.set(cacheKey, sdk);
  return sdk;
}
