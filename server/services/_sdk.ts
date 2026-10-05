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
import { storefrontCacheKey, storefrontKey } from '../utils/tenant';
import {
  readConfiguratorBackendValue,
  readConfiguratorMerchantApiUrl,
} from './configurator-config';
import type { GeinsSettings as TenantGeinsSettings } from '#shared/types/tenant-config';

export interface TenantSDK {
  core: GeinsCore;
  crm: GeinsCRM;
  cms: GeinsCMS;
  oms: GeinsOMS;
  /** The GraphQL endpoint the instance was built for; undefined is the SDK default. */
  apiUrl?: string;
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

/** Per-storefront singleton cache, keyed by `storefrontCacheKey`. */
const tenants = new LRUCache<string, TenantSDK>({ max: 100 });

/**
 * Clears cached SDK instances for a storefront.
 * Called by the webhook handler on config invalidation so the next request
 * creates a fresh SDK with up-to-date geinsSettings.
 */
export function clearSdkCache(storefrontKey: string): void {
  const target = tenants.get(storefrontKey);
  if (!target) {
    // Try direct delete in case only hostname key exists
    tenants.delete(storefrontKey);
    return;
  }
  // Remove all keys pointing to the same SDK instance (storefront key + request hostnames)
  const keysToDelete: string[] = [];
  for (const [key, sdk] of tenants) {
    if (sdk === target) keysToDelete.push(key);
  }
  for (const key of keysToDelete) tenants.delete(key);
}

/**
 * The merchant-api GraphQL URL the SDK talks to. On a CPQ backend
 * (`merchant-api` or `composite`) it is the configurator's URL, because the
 * ordinary endpoint drops a configured line's configuration on every cart
 * write. Otherwise undefined, and the SDK keeps its default. The backend is
 * matched strictly, as `resolveConfiguratorBackendName` does.
 */
export function resolveSdkApiUrl(event: H3Event): string | undefined {
  const backend = readConfiguratorBackendValue(event);
  if (backend !== 'merchant-api' && backend !== 'composite') return undefined;
  const url = readConfiguratorMerchantApiUrl(event);
  return typeof url === 'string' && url !== '' ? url : undefined;
}

/**
 * Creates a Geins SDK instance from tenant Geins settings. `apiUrl` is only
 * set on the SDK when given, so without it the settings are what they were.
 */
export function createTenantSDK(
  geinsSettings: TenantGeinsSettings,
  apiUrl?: string,
): TenantSDK {
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
    ...(apiUrl ? { apiUrl } : {}),
  };

  const core = new GeinsCore(sdkSettings);
  const crm = new GeinsCRM(core, { clientConnectionMode: 'Direct' });
  const cms = new GeinsCMS(core);
  const oms = new GeinsOMS(core, {
    omsSettings: { context: RuntimeContext.SERVER },
  });

  return { core, crm, cms, oms, ...(apiUrl ? { apiUrl } : {}) };
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
 * Different storefronts get different instances, also two channels on one
 * account. Every alias of a storefront shares one SDK instance.
 */
export async function getTenantSDK(event: H3Event): Promise<TenantSDK> {
  const hostname = event.context.tenant?.hostname;
  if (!hostname) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'No tenant context on request');
  }

  // Falls back to the request hostname for API routes where the config may
  // not be resolved yet
  const cacheKey = storefrontCacheKey(event);
  // A cached instance counts only when it talks to the same endpoint, so the
  // key format, and `clearSdkCache` with it, stays as it is.
  const apiUrl = resolveSdkApiUrl(event);
  const onEndpoint = (sdk: TenantSDK | undefined) =>
    sdk?.apiUrl === apiUrl ? sdk : undefined;

  const cached = onEndpoint(tenants.get(cacheKey));
  if (cached) {
    return cached;
  }

  // Prefer the config already resolved by 02.tenant-context plugin
  const tenant =
    event.context.tenant.config ?? (await resolveTenant(hostname, event));
  if (!tenant?.geinsSettings) {
    throw createAppError(
      ErrorCode.BAD_REQUEST,
      'Tenant has no Geins SDK configuration',
    );
  }

  // Check again with the resolved storefront — another hostname for
  // the same storefront may have already created the SDK instance
  const tid = storefrontKey(tenant, hostname);
  const existing = onEndpoint(tenants.get(tid));
  if (existing) {
    // Also cache under the current lookup key for fast path next time
    if (cacheKey !== tid) tenants.set(cacheKey, existing);
    return existing;
  }

  const sdk = createTenantSDK(tenant.geinsSettings, apiUrl);
  // Cache under both the storefront key and the lookup key
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
  const authToken = getSessionToken(event);
  if (!languageId && !marketId && !authToken) return undefined;
  const ctx: RequestContext = {};
  if (languageId) ctx.languageId = languageId;
  if (marketId) ctx.marketId = marketId;
  if (authToken) ctx.userToken = authToken;
  return ctx;
}
