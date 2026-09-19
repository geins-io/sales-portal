import { GeinsCore } from '@geins/core';
import { GeinsCRM } from '@geins/crm';
import { GeinsCMS } from '@geins/cms';
import { GeinsOMS } from '@geins/oms';
import { RuntimeContext } from '@geins/types';
import type {
  GeinsSettings as SdkGeinsSettings,
  RequestContext,
} from '@geins/types';
import type { H3Event } from 'h3';
import { LRUCache } from 'lru-cache';
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
 *
 * `geinsSettings` ultimately comes from KV storage via a bare type
 * assertion (`storage.getItem<TenantConfig>(...)`, no runtime validation),
 * so a malformed or stale record can reach here with an `environment` value
 * outside the type. Throwing on anything but the two known values is
 * deliberate: silently falling through to 'prod' — the previous
 * behavior — is exactly backwards, since it means the failure mode for bad
 * data is "quietly talk to production" rather than "stop and get fixed."
 *
 * Throws via `createTenantConfigInvalidError` (ErrorCode.TENANT_CONFIG_INVALID)
 * rather than a raw `Error` so callers of `getTenantSDK()` — currently
 * server/api/auth/me.get.ts, server/utils/load-user.ts, and
 * server/api/__sitemap__/urls.ts — can tell this apart from the unrelated
 * failure their catch block was originally written for (expired session,
 * fail-open lookup miss, unreachable API) via `isErrorCode(error,
 * ErrorCode.TENANT_CONFIG_INVALID)`, instead of silently misattributing it.
 */
function mapEnvironment(
  env?: TenantGeinsSettings['environment'],
): SdkGeinsSettings['environment'] {
  switch (env) {
    case 'staging':
      return 'qa';
    case 'production':
      return 'prod';
    default:
      throw createTenantConfigInvalidError(
        `Unknown Geins environment: "${env}". Expected "production" or "staging".`,
        { environment: env },
      );
  }
}

/** Per-tenant singleton cache. Same tenant reuses the same SDK instance. */
const tenants = new LRUCache<string, TenantSDK>({ max: 100 });

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
  // Use the first availableLocale as SDK default. The admin's configured
  // locale (e.g., en-US) may not match product data (sv-SE). This ensures
  // getRequestChannelVariables falls back to the right locale when no
  // cookies are set. RequestContext handles per-request overrides for
  // cart/checkout/CMS operations separately.
  const effectiveLocale =
    geinsSettings.availableLocales?.[0] ?? geinsSettings.locale;

  const sdkSettings: SdkGeinsSettings = {
    apiKey: geinsSettings.apiKey,
    accountName: geinsSettings.accountName,
    channel: geinsSettings.channel,
    tld: geinsSettings.tld,
    locale: effectiveLocale,
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
/**
 * Ensures a locale is in BCP-47 format (e.g. 'sv-SE', not 'sv').
 * Geins GraphQL API returns 0 results for short locale codes.
 *
 * Resolution order:
 * 1. Already BCP-47 → return as-is
 * 2. Short code → find matching BCP-47 in availableLocales list
 * 3. Short code → match against SDK default locale
 * 4. Fallback → SDK default locale
 */
function ensureBcp47Locale(
  locale: string | undefined,
  sdkLocale: string,
  availableLocales?: string[],
): string {
  if (!locale) return sdkLocale;
  if (locale.includes('-')) return locale;

  // Check all available locales for a match (e.g. 'sv' → 'sv-SE')
  if (availableLocales?.length) {
    const match = availableLocales.find((l) => l.split('-')[0] === locale);
    if (match) return match;
  }

  // Fall back to SDK default if it matches
  if (sdkLocale.split('-')[0] === locale) return sdkLocale;

  return sdkLocale;
}

export function getChannelVariables(
  sdk: TenantSDK,
  localeOverride?: string,
  marketOverride?: string,
  availableLocales?: string[],
): {
  channelId: string;
  languageId: string;
  marketId: string;
} {
  const settings = sdk.core.geinsSettings;
  return {
    channelId: `${settings.channel}|${settings.tld}`,
    languageId: ensureBcp47Locale(
      localeOverride,
      settings.locale,
      availableLocales,
    ),
    marketId: marketOverride ?? settings.market,
  };
}

/**
 * Composes getChannelVariables with request-level locale and market.
 * Use this in service functions to automatically pipe the user's preferences
 * into GraphQL queries.
 *
 * getRequestLocale returns BCP-47 from resolvedLocaleMarket when available
 * (page routes), so ensureBcp47Locale is a safety net for the cookie fallback
 * path (API routes) where a short code may still arrive.
 */
export function getRequestChannelVariables(
  sdk: TenantSDK,
  event: H3Event,
): {
  channelId: string;
  languageId: string;
  marketId: string;
} {
  const tenantConfig = event.context.tenant?.config as
    | { geinsSettings?: { availableLocales?: string[] } }
    | undefined;

  return getChannelVariables(
    sdk,
    getRequestLocale(event),
    getRequestMarket(event),
    tenantConfig?.geinsSettings?.availableLocales,
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

  // The environment is checked before the cache is consulted, not only when
  // an SDK is built. A cached instance outlives the record it was built
  // from, so a config that later goes malformed would keep being served by
  // an SDK still pointed at the environment it used to name — the stale-data
  // case this whole change exists for. Reading it is free: the plugin has
  // already put the config on the event.
  const resolved = event.context.tenant.config;
  if (resolved?.geinsSettings) {
    mapEnvironment(resolved.geinsSettings.environment);
  }

  const cached = tenants.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Prefer the config already resolved by 02.tenant-context plugin
  const tenant = resolved ?? (await resolveTenant(hostname, event));
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

/**
 * Builds a RequestContext from the current request's locale and market.
 * Returns undefined if no locale or market is available — this prevents
 * spreading { languageId: undefined } which would override valid defaults.
 */
export function buildRequestContext(
  event: H3Event,
): RequestContext | undefined {
  const languageId = getRequestLocale(event);
  const marketId = getRequestMarket(event);
  const { authToken } = getAuthCookies(event);
  if (!languageId && !marketId && !authToken) return undefined;
  const ctx: RequestContext = {};
  if (languageId) ctx.languageId = languageId;
  if (marketId) ctx.marketId = marketId;
  if (authToken) ctx.userToken = authToken;
  return ctx;
}
