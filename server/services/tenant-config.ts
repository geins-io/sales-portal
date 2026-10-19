import type { H3Event } from 'h3';
import type {
  TenantConfig,
  PublicTenantConfig,
} from '#shared/types/tenant-config';
import { logger } from '../utils/logger';
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

/** The subset of a `getChannel` response this module reads. */
interface ChannelAssetSource {
  assetHost?: string | null;
}

/** The channel's asset library host, when it has one and it can be read. */
async function readAssetHost(event: H3Event): Promise<string | undefined> {
  try {
    const channel = (await getChannel(event, {
      timeoutMs: ASSET_HOST_TIMEOUT_MS,
    })) as ChannelAssetSource | null;
    const host = channel?.assetHost;
    return typeof host === 'string' && host ? host : undefined;
  } catch {
    // Cached so for up to an hour: widgets fall back to `url`, JSON widgets to the legacy file.
    logger.warn(
      '[config] channel read failed; config served without the asset host',
      {
        hostname: event.context.tenant.hostname,
      },
    );
    return undefined;
  }
}
