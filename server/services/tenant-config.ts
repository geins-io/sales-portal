import type { H3Event } from 'h3';
import { LRUCache } from 'lru-cache';
import type {
  TenantConfig,
  PublicTenantConfig,
} from '#shared/types/tenant-config';
import { logger } from '../utils/logger';
import { storefrontCacheKey } from '../utils/tenant';
import { getChannel } from './channels';

/**
 * Tenant Config Service — sectioned accessors over TenantConfig.
 * Insulates the app from schema changes. All methods read the tenant config
 * from event.context (already resolved by 02.tenant-context plugin).
 */

function resolveConfig(event: H3Event): TenantConfig | null {
  return event.context.tenant?.config ?? null;
}

export async function getConfig(event: H3Event): Promise<TenantConfig | null> {
  return resolveConfig(event);
}

export async function getTheme(
  event: H3Event,
): Promise<TenantConfig['theme'] | null> {
  const config = await resolveConfig(event);
  return config?.theme ?? null;
}

export async function getBranding(
  event: H3Event,
): Promise<TenantConfig['branding'] | null> {
  const config = await resolveConfig(event);
  return config?.branding ?? null;
}

export async function getFeatures(
  event: H3Event,
): Promise<TenantConfig['features'] | null> {
  const config = await resolveConfig(event);
  return config?.features ?? null;
}

export async function getSeo(
  event: H3Event,
): Promise<TenantConfig['seo'] | null> {
  const config = await resolveConfig(event);
  return config?.seo ?? null;
}

export async function getContact(
  event: H3Event,
): Promise<TenantConfig['contact'] | null> {
  const config = await resolveConfig(event);
  return config?.contact ?? null;
}

export async function getMode(
  event: H3Event,
): Promise<'commerce' | 'catalog' | null> {
  const config = await resolveConfig(event);
  return config?.mode ?? null;
}

/**
 * Check if a feature is enabled. Returns false if config is unavailable
 * or the feature doesn't exist.
 */
export async function isFeatureEnabled(
  event: H3Event,
  feature: string,
): Promise<boolean> {
  const config = await resolveConfig(event);
  if (!config?.features) return false;
  const featureConfig = config.features[feature];
  if (!featureConfig) return false;
  return featureConfig.enabled;
}

/**
 * Produces the public config sent to the client.
 * Strips geinsSettings, overrides, themeHash, createdAt, updatedAt.
 * Exposes locale fields derived from geinsSettings.
 */
export async function getPublicConfig(
  event: H3Event,
): Promise<PublicTenantConfig | null> {
  const config = await resolveConfig(event);
  if (!config) return null;

  const assetBaseUrl = config.geinsSettings
    ? await readAssetHost(event)
    : undefined;

  return {
    tenantId: config.tenantId,
    hostname: config.hostname,
    aliases: config.aliases,
    mode: config.mode,
    checkoutMode: config.checkoutMode,
    timezone: config.timezone,
    theme: config.theme,
    branding: config.branding,
    layout: config.layout,
    features: config.features,
    cms: config.cms,
    seo: config.seo,
    contact: config.contact,
    css: config.css,
    isActive: config.isActive,
    locale: config.geinsSettings?.locale,
    market: config.geinsSettings?.market,
    availableLocales: config.geinsSettings?.availableLocales ?? [],
    availableMarkets: config.geinsSettings?.availableMarkets ?? [],
    imageBaseUrl: config.geinsSettings?.accountName
      ? `https://${config.geinsSettings.accountName}.commerce.services`
      : '',
    ...(assetBaseUrl ? { assetBaseUrl } : {}),
  };
}

/** How long the config waits for the channel's asset host before going without it. */
export const ASSET_HOST_TIMEOUT_MS = 3_000;

/** How long after a failed read the config is refreshed to read the host again. */
export const ASSET_HOST_RETRY_MS = 30_000;

/** The subset of a `getChannel` response this module reads. */
interface ChannelAssetSource {
  assetHost?: string | null;
}

/**
 * The last asset-host read per storefront: what a read answered (a host, or
 * null for a channel without one), or when a read failed with no answer to
 * fall back on. Lives beside the `/api/config` response cache, which holds one
 * `maxAge` for every entry and so cannot expire a failed read sooner.
 */
type AssetHostRead = { host: string | null } | { failedAt: number };

const assetHostReads = new LRUCache<string, AssetHostRead>({ max: 1000 });

/**
 * Whether the cached `/api/config` for this storefront should be refreshed to
 * read the asset host again: 30 s after a failed read, or when this process
 * has no read at all while a cached config may exist (a dev restart keeps the
 * filesystem cache). A read that answered, with or without a host, is never
 * retried; the config's own hour applies.
 */
export function assetHostRetryDue(event: H3Event): boolean {
  if (!resolveConfig(event)?.geinsSettings) return false;
  const read = assetHostReads.get(storefrontCacheKey(event));
  if (!read) return true;
  return (
    'failedAt' in read && Date.now() - read.failedAt >= ASSET_HOST_RETRY_MS
  );
}

/** Forgets a storefront's asset-host read, as the config-refresh webhook does. */
export function clearAssetHost(storefront: string): void {
  assetHostReads.delete(storefront);
}

/**
 * The channel's asset library host. A failed read keeps what an earlier read
 * answered; with no earlier answer the config goes without the host until
 * {@link assetHostRetryDue} refreshes it.
 */
async function readAssetHost(event: H3Event): Promise<string | undefined> {
  const storefront = storefrontCacheKey(event);
  try {
    const channel = (await getChannel(event, {
      timeoutMs: ASSET_HOST_TIMEOUT_MS,
    })) as ChannelAssetSource | null;
    const host = channel?.assetHost;
    const read = typeof host === 'string' && host ? host : null;
    assetHostReads.set(storefront, { host: read });
    return read ?? undefined;
  } catch {
    const context = { hostname: event.context.tenant.hostname, storefront };
    const known = assetHostReads.get(storefront);
    if (known && 'host' in known) {
      logger.warn(
        '[config] channel read failed; config served with the last read asset host',
        context,
      );
      return known.host ?? undefined;
    }
    assetHostReads.set(storefront, { failedAt: Date.now() });
    logger.warn(
      `[config] channel read failed; config served without the asset host, read again in ${ASSET_HOST_RETRY_MS / 1000} s`,
      context,
    );
    return undefined;
  }
}
