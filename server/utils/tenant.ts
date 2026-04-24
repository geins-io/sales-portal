import type { H3Event } from 'h3';
import type { TenantConfig } from '#shared/types/tenant-config';
import { CMS_SLOTS } from '#shared/types/cms-slots';
import { CMS_MENUS } from '#shared/constants/cms';
import type { StoreSettings, GeinsSettings } from '../schemas/store-settings';
import { StoreSettingsSchema } from '../schemas/store-settings';
import { deriveThemeColors } from './theme';
import { KV_STORAGE_KEYS } from '#shared/constants/storage';
import { logger } from './logger';
import {
  createDefaultTheme,
  generateTenantCss,
  generateThemeHash,
  buildDerivedTheme,
} from './tenant-css';

/**
 * Default GeinsSettings for auto-created and fallback tenants.
 * Single source of truth — used in fetchTenantConfig and createTenant.
 */
export const DEFAULT_GEINS_SETTINGS: GeinsSettings = {
  apiKey: process.env.GEINS_API_KEY || '',
  accountName: process.env.GEINS_ACCOUNT_NAME || '',
  channel: process.env.GEINS_CHANNEL || '1',
  tld: process.env.GEINS_TLD || 'se',
  locale: process.env.GEINS_LOCALE || 'sv-SE',
  market: process.env.GEINS_MARKET || 'se',
  environment:
    (process.env.GEINS_ENVIRONMENT as 'production' | 'staging') || 'production',
  availableLocales: [process.env.GEINS_LOCALE || 'sv-SE'],
  availableMarkets: [process.env.GEINS_MARKET || 'se'],
};

// ---------------------------------------------------------------------------
// Negative cache
// ---------------------------------------------------------------------------

/**
 * Negative cache — hostnames that resolved to inactive/missing tenants.
 * Prevents thundering herd of API calls for unknown hostnames (bots, scanners).
 * Entries expire after NEGATIVE_CACHE_TTL_MS.
 */
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const NEGATIVE_CACHE_MAX_SIZE = 1000;
const negativeCache = new Map<string, number>();

function isNegativelyCached(hostname: string): boolean {
  const expiresAt = negativeCache.get(hostname);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    negativeCache.delete(hostname);
    return false;
  }
  return true;
}

function addToNegativeCache(hostname: string): void {
  if (negativeCache.size >= NEGATIVE_CACHE_MAX_SIZE) {
    const oldest = negativeCache.keys().next().value;
    if (oldest !== undefined) negativeCache.delete(oldest);
  }
  negativeCache.set(hostname, Date.now() + NEGATIVE_CACHE_TTL_MS);
}

/** Clears negative cache entries for a hostname (called on webhook invalidation). */
export function clearNegativeCache(hostname: string): void {
  negativeCache.delete(hostname);
}

// ---------------------------------------------------------------------------
// KV key generators
// ---------------------------------------------------------------------------

export function tenantIdKey(hostname: string): string {
  return `${KV_STORAGE_KEYS.TENANT_ID_PREFIX}${hostname}`;
}

export function tenantConfigKey(tenantId: string): string {
  return `${KV_STORAGE_KEYS.TENANT_CONFIG_PREFIX}${tenantId}`;
}

// ---------------------------------------------------------------------------
// Hostname utilities
// ---------------------------------------------------------------------------

/**
 * Collects all hostnames associated with a tenant config.
 * Returns a Set of: hostname, aliases, and any other hostname fields.
 */
export function collectAllHostnames(config: TenantConfig): Set<string> {
  const hostnames = new Set<string>();
  if (config.hostname) hostnames.add(config.hostname);
  if (config.aliases) {
    for (const alias of config.aliases) {
      if (alias) hostnames.add(alias);
    }
  }
  return hostnames;
}

/**
 * Writes hostname → tenantId mappings for all hostnames in the config.
 *
 * Logs a loud warning when a hostname is being remapped from one
 * tenantId to another — this usually means two merchant-API tenant
 * configs claim the same alias (tenant misconfiguration, e.g. a copy
 * paste bug in the admin). We still perform the write so recoverable
 * reconfigurations work, but the warning makes the misconfig visible.
 */
export async function writeHostnameMappings(
  storage: ReturnType<typeof useStorage>,
  config: TenantConfig,
): Promise<void> {
  const hostnames = collectAllHostnames(config);
  const tid = config.tenantId;
  await Promise.all(
    [...hostnames].map(async (h) => {
      const existing = await storage.getItem<string>(tenantIdKey(h));
      if (existing && existing !== tid) {
        logger.warn(
          `[tenant] Hostname "${h}" remapped ${existing} → ${tid}. ` +
            `Two tenant configs may claim the same alias.`,
          { hostname: h, previousTenantId: existing, newTenantId: tid },
        );
      }
      await storage.setItem(tenantIdKey(h), tid);
    }),
  );
}

// ---------------------------------------------------------------------------
// Settings transform
// ---------------------------------------------------------------------------

/**
 * Transforms platform-injected geinsSettings into our clean internal shape.
 * Platform: { channelId: "2|se", defaultLocale, defaultMarket, locales[], markets[] }
 * Ours: { channel, tld, locale, market, availableLocales[], availableMarkets[] }
 */
export function transformGeinsSettings(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const channelId = String(raw.channelId ?? '');
  const [channel, tld] = channelId.split('|');

  return {
    apiKey: raw.apiKey,
    accountName: raw.accountName,
    channel,
    tld,
    locale: raw.defaultLocale,
    market: raw.defaultMarket,
    availableLocales: raw.locales ?? [],
    availableMarkets: raw.markets ?? [],
  };
}

// ---------------------------------------------------------------------------
// Config building & fetching
// ---------------------------------------------------------------------------

/**
 * Builds a TenantConfig from validated StoreSettings.
 * Derives colors, merges override features, generates CSS + hash.
 */
export function buildTenantConfig(settings: StoreSettings): TenantConfig {
  const derivedColors = deriveThemeColors(settings.theme.colors);

  // Merge override features into base features
  const features = { ...settings.features };
  if (settings.overrides?.features) {
    for (const [key, value] of Object.entries(settings.overrides.features)) {
      features[key] = value;
    }
  }

  const themeName = settings.theme.name ?? settings.tenantId;

  const css = generateTenantCss(
    themeName,
    derivedColors,
    settings.theme.radius,
    settings.overrides?.css,
    settings.theme.typography,
  );

  const theme: TenantConfig['theme'] = {
    ...settings.theme,
    name: themeName,
    colors: derivedColors,
  };

  const themeHash = generateThemeHash(theme);

  return {
    tenantId: settings.tenantId,
    hostname: settings.hostname,
    aliases: settings.aliases,
    geinsSettings: settings.geinsSettings,
    mode: settings.mode,
    checkoutMode: settings.checkoutMode,
    theme,
    branding: settings.branding,
    features,
    seo: settings.seo,
    contact: settings.contact,
    overrides: settings.overrides,
    css,
    themeHash,
    isActive: settings.isActive,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

export async function fetchTenantConfig(
  hostname: string,
  event?: H3Event,
): Promise<TenantConfig | null> {
  const config = useRuntimeConfig(event);

  try {
    const response = await fetch(
      `${config.geins.tenantApiUrl}?hostname=${hostname}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.ok) {
      const data = await response.json();

      if (data.geinsSettings) {
        data.geinsSettings = transformGeinsSettings(
          data.geinsSettings as Record<string, unknown>,
        );
      }
      delete data.geinsApiSettings;
      delete data.id;

      const parsed = StoreSettingsSchema.safeParse(data);

      if (parsed.success) {
        return buildTenantConfig(parsed.data);
      }

      logger.error(
        `[tenant] Schema validation failed for ${hostname}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      );
    }
  } catch {
    // External API unavailable — fall through to default handling
  }

  // If autoCreateTenant is enabled, create an active tenant for development/testing
  if (config.autoCreateTenant) {
    const defaultTheme = createDefaultTheme(hostname);
    const { themeWithDerived, css } = buildDerivedTheme(defaultTheme);

    return {
      tenantId: hostname,
      hostname,
      geinsSettings: { ...DEFAULT_GEINS_SETTINGS },
      mode: 'commerce' as const,
      checkoutMode: 'hosted' as const,
      theme: themeWithDerived,
      css,
      branding: {
        name: hostname,
        watermark: 'full' as const,
      },
      features: {
        search: { enabled: true },
        authentication: { enabled: true },
        registration: { enabled: true },
        cart: { enabled: true },
        wishlist: { enabled: true },
      },
      // Seed the CMS slot + menu registry with the Geins out-of-box
      // names so dev / auto-provisioned tenants work without extra
      // config. Production tenants override or add entries via their
      // stored config (tenant config is the single source of truth).
      cms: {
        slots: {
          [CMS_SLOTS.PORTAL_HERO]: {
            family: 'Portal (Customer logged in)',
            areaName: 'Above Content',
          },
          [CMS_SLOTS.FRONTPAGE_CONTENT]: {
            family: 'Frontpage',
            areaName: 'Content',
          },
        },
        menus: {
          [CMS_MENUS.HEADER_MAIN]: { menuLocationId: 'main' },
          [CMS_MENUS.FOOTER]: { menuLocationId: 'footer' },
          [CMS_MENUS.MOBILE_DRAWER]: { menuLocationId: 'main' },
          [CMS_MENUS.SIDEBAR_FALLBACK]: { menuLocationId: 'info-pages' },
        },
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Default: return inactive config
  return {
    tenantId: 'no-tenant',
    hostname: 'not-found',
    geinsSettings: { ...DEFAULT_GEINS_SETTINGS },
    mode: 'commerce' as const,
    checkoutMode: 'hosted' as const,
    theme: createDefaultTheme(hostname),
    css: '',
    branding: {
      name: 'not-found',
      watermark: 'none' as const,
    },
    features: {},
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tenant resolution
// ---------------------------------------------------------------------------

/**
 * Retrieves a tenant config directly by tenantId (no hostname lookup).
 * Returns null for missing or inactive configs without side-effects —
 * invalidation is handled exclusively by the webhook handler.
 */
export async function getTenantById(
  tenantId: string,
): Promise<TenantConfig | null> {
  const storage = useStorage('kv');
  const config = await storage.getItem<TenantConfig>(tenantConfigKey(tenantId));
  if (!config || !config.isActive) return null;
  return config;
}

/**
 * Resolves a tenant config from a hostname using the 2-step KV model:
 *   1. tenant:id:{hostname} → tenantId
 *   2. tenant:config:{tenantId} → TenantConfig
 *
 * On cache miss, fetches from the API and writes both hostname mappings
 * and the config keyed by tenantId.
 *
 * Backwards compat: checks for legacy tenant:config:{hostname} and migrates.
 */
export async function resolveTenant(
  hostname: string,
  event?: H3Event,
): Promise<TenantConfig | null> {
  if (isNegativelyCached(hostname)) return null;

  const storage = useStorage('kv');

  // Step 1: hostname → tenantId
  const tenantId = await storage.getItem<string>(tenantIdKey(hostname));

  if (tenantId) {
    const config = await getTenantById(tenantId);
    if (config) {
      // Defensive re-validation: make sure the config we loaded actually
      // claims the hostname we were asked about. If two tenants claimed
      // the same alias at some point, the KV entry for that hostname may
      // still point at the WRONG tenantId even after the merchant admin
      // corrected the alias — nothing invalidates stale mappings.
      //
      // Re-validating here lets us self-heal: delete the bad KV key,
      // fall through to the fresh merchant-API fetch, which writes the
      // correct mapping. Costs one Set membership check per cache hit.
      const claimed = collectAllHostnames(config);
      if (claimed.has(hostname)) return config;
      logger.warn(
        `[tenant] Stale hostname mapping: "${hostname}" → "${tenantId}" ` +
          `but that tenant no longer claims the hostname. Busting KV and ` +
          `re-fetching.`,
        { hostname, staleTenantId: tenantId },
      );
      await storage.removeItem(tenantIdKey(hostname));
    }
  }

  // Backwards compat: check for legacy tenant:config:{hostname}
  const legacyConfig = await storage.getItem<TenantConfig>(
    tenantConfigKey(hostname),
  );
  if (legacyConfig && legacyConfig.isActive) {
    const tid = legacyConfig.tenantId || hostname;
    if (tid !== hostname) {
      await storage.setItem(tenantConfigKey(tid), legacyConfig);
      await storage.removeItem(tenantConfigKey(hostname));
    }
    await writeHostnameMappings(storage, legacyConfig);
    return legacyConfig;
  }

  // Cache miss — fetch from API
  const newConfig = await fetchTenantConfig(hostname, event);
  if (!newConfig) {
    addToNegativeCache(hostname);
    return null;
  }

  if (newConfig.isActive) {
    const tid = newConfig.tenantId || hostname;
    await storage.setItem(tenantConfigKey(tid), newConfig);
    await writeHostnameMappings(storage, newConfig);
    return newConfig;
  }

  addToNegativeCache(hostname);
  return null;
}
