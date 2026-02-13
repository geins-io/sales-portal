import type { H3Event } from 'h3';
import type {
  TenantConfig,
  PublicTenantConfig,
  FeatureConfig,
} from '#shared/types/tenant-config';
import { getTenant } from '../utils/tenant';

/**
 * Tenant Config Service — sectioned accessors over TenantConfig.
 * Insulates the app from schema changes. All methods resolve the tenant
 * from the request event using getTenant() (already KV-cached with SWR).
 */

async function resolveConfig(event: H3Event): Promise<TenantConfig | null> {
  const { hostname } = event.context.tenant;
  return getTenant(hostname, event);
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
): Promise<Record<string, FeatureConfig> | null> {
  const config = await resolveConfig(event);
  return (config?.features as Record<string, FeatureConfig>) ?? null;
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

  return {
    tenantId: config.tenantId,
    hostname: config.hostname,
    aliases: config.aliases,
    mode: config.mode,
    theme: config.theme,
    branding: config.branding,
    features: config.features,
    seo: config.seo,
    contact: config.contact,
    css: config.css,
    isActive: config.isActive,
    locale: config.geinsSettings?.locale,
    market: config.geinsSettings?.market,
    availableLocales: config.geinsSettings?.availableLocales ?? [],
    availableMarkets: config.geinsSettings?.availableMarkets ?? [],
  };
}
