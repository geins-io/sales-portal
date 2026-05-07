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
 * Default CMS slot + menu mapping using Geins's out-of-box admin family and
 * areaName values. Applied when a tenant's StoreSettings does not define
 * `cms` explicitly, so every Geins tenant works without per-tenant config.
 *
 * A tenant CAN override by setting `cms` on its StoreSettings. Verified
 * against pinchtab + Geins admin (see MEMORY: Portal (Customer logged in),
 * Frontpage, Productlist, Product, main/footer/info-pages).
 */
export const DEFAULT_CMS_CONFIG: NonNullable<TenantConfig['cms']> = {
  slots: {
    [CMS_SLOTS.PORTAL_HERO]: {
      family: 'Portal (Customer logged in)',
      areaName: 'Above Content',
    },
    [CMS_SLOTS.FRONTPAGE_CONTENT]: {
      family: 'Frontpage',
      areaName: 'Content',
    },
    [CMS_SLOTS.PRODUCT_LIST_TOP]: {
      family: 'Productlist',
      areaName: 'Above List',
    },
    [CMS_SLOTS.PRODUCT_LIST_BOTTOM]: {
      family: 'Productlist',
      areaName: 'Below List',
    },
    [CMS_SLOTS.PRODUCT_DETAIL]: {
      family: 'Product',
      areaName: 'Below Details',
    },
  },
  menus: {
    [CMS_MENUS.HEADER_MAIN]: { menuLocationId: 'main' },
    [CMS_MENUS.FOOTER]: { menuLocationId: 'footer' },
    [CMS_MENUS.MOBILE_DRAWER]: { menuLocationId: 'main' },
    [CMS_MENUS.SIDEBAR_FALLBACK]: { menuLocationId: 'info-pages' },
  },
};

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

  // CMS: explicit tenant config wins, otherwise fall back to the standard
  // Geins out-of-box family/areaName values + menu locations. Lets every
  // tenant render slots/menus without per-tenant overrides.
  const cms =
    (settings as { cms?: TenantConfig['cms'] }).cms ?? DEFAULT_CMS_CONFIG;

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
    cms,
    css,
    themeHash,
    isActive: settings.isActive,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

/**
 * Adapt the merchant API response to our internal `StoreSettings` shape.
 *
 * The API returns `{ geinsSettings, appSettings, ... }` where `appSettings`
 * is the bulk of the per-tenant config (theme, branding, features, cms,
 * aliases) and `geinsSettings` carries Geins API creds + every hostname
 * the tenant is reachable on (`defaultHostName` + `additionalHostNames`).
 *
 * Steps:
 *   1. Pull `appSettings` to root (or fall back to the raw response if a
 *      future merchant API serves a flat shape — we don't fight it).
 *   2. Pull root-level identity fields (`tenantId`, `isActive`, `createdAt`,
 *      `updatedAt`) as fallbacks — the API sometimes emits these outside
 *      `appSettings` (observed after a Geins admin reset). `appSettings`
 *      wins when both define a field.
 *   3. Derive `hostname` from `geinsSettings.defaultHostName` when not
 *      present in `appSettings`.
 *   4. Convert `geinsSettings` from the API's "Geins API" shape (channelId,
 *      defaultLocale, locales) to our internal flat shape via
 *      `transformGeinsSettings`.
 *   5. Merge `geinsSettings.additionalHostNames` into `aliases` so any
 *      configured hostname resolves the right tenant on subsequent KV
 *      lookups (the API keeps these in two places — we want one).
 *   6. Drop a couple of legacy fields the API still emits but our schema
 *      doesn't care about (`id`, `geinsApiSettings`).
 */
export function adaptMerchantApiResponse(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const appSettings = (raw.appSettings as Record<string, unknown>) ?? raw;
  const rawGeins = raw.geinsSettings as Record<string, unknown> | undefined;

  const geinsSettings = rawGeins ? transformGeinsSettings(rawGeins) : undefined;

  const additional = Array.isArray(rawGeins?.additionalHostNames)
    ? (rawGeins.additionalHostNames as string[])
    : [];
  const existing = Array.isArray(appSettings.aliases)
    ? (appSettings.aliases as string[])
    : [];
  const aliases = Array.from(new Set([...existing, ...additional]));

  const candidate: Record<string, unknown> = {
    // Root-level identity fields the API sometimes emits outside appSettings.
    // appSettings spreads on top and wins when both define a field.
    tenantId: raw.tenantId,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    hostname: rawGeins?.defaultHostName,
    ...appSettings,
    geinsSettings,
    aliases,
  };
  delete candidate.geinsApiSettings;
  delete candidate.id;
  return candidate;
}

/**
 * Parse a candidate StoreSettings tolerantly.
 *
 * Strict `StoreSettingsSchema.safeParse` is the happy path. When the
 * merchant API ships a renamed field, an unexpected enum value, or
 * drops something we depend on, the strict parse fails — and a single
 * brittle field would otherwise blank an entire tenant (PR #144 fixed
 * one such break, this wrapper prevents the next one from paging us).
 *
 * Strategy: salvage. Walk each top-level Zod issue, substitute a
 * conservative default at the failing path, retry. If we still can't
 * land a valid config after a bounded number of substitutions, give up
 * and return null (caller falls back to autoCreate / default tenant).
 *
 * We intentionally do NOT silently swap critical credentials
 * (`tenantId`, `hostname`, `geinsSettings.apiKey`) — those failures
 * stay fatal so we don't serve a half-broken tenant claiming wrong IDs.
 * Theme and branding are presentation config, not credentials; missing
 * values are salvaged with neutral defaults so a reset tenant renders
 * with a plain look rather than hard-failing with a 500.
 */
export function parseStoreSettingsResilient(
  candidate: unknown,
  hostname: string,
): StoreSettings | null {
  const strict = StoreSettingsSchema.safeParse(candidate);
  if (strict.success) return strict.data;

  if (typeof candidate !== 'object' || candidate === null) {
    logger.error(
      `[tenant] Schema validation failed for ${hostname}: candidate is not an object`,
    );
    return null;
  }

  const SALVAGE_DEFAULTS: Record<string, unknown> = {
    mode: 'commerce',
    checkoutMode: 'custom',
    aliases: [],
    seo: null,
    contact: null,
    overrides: null,
    cms: undefined,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    theme: {
      colors: {
        primary: 'oklch(0.5 0.2 260)',
        primaryForeground: 'oklch(1 0 0)',
        secondary: 'oklch(0.95 0.01 260)',
        secondaryForeground: 'oklch(0.2 0.02 260)',
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.145 0 0)',
      },
    },
    branding: {
      name: 'Store',
      watermark: 'full',
    },
  };
  const FATAL_PATHS = new Set([
    'tenantId',
    'hostname',
    'geinsSettings',
    'geinsSettings.apiKey',
    'geinsSettings.accountName',
    'features',
  ]);

  // Work on a shallow copy; mutate a single field per iteration.
  let work: Record<string, unknown> = {
    ...(candidate as Record<string, unknown>),
  };
  let parsed = StoreSettingsSchema.safeParse(work);
  const MAX_SUBSTITUTIONS = 12;
  const applied: string[] = [];

  for (let i = 0; i < MAX_SUBSTITUTIONS && !parsed.success; i++) {
    const issue = parsed.error.issues[0];
    if (!issue) break;
    const top = String(issue.path[0] ?? '');
    const dotted = issue.path.map(String).join('.');
    if (!top || FATAL_PATHS.has(dotted) || FATAL_PATHS.has(top)) {
      logger.error(
        `[tenant] Schema validation failed for ${hostname} on a fatal path (${dotted}): ${issue.message}`,
      );
      return null;
    }
    if (!(top in SALVAGE_DEFAULTS)) {
      logger.error(
        `[tenant] Schema validation failed for ${hostname} (${dotted}): ${issue.message}; no salvage default`,
      );
      return null;
    }
    work = { ...work, [top]: SALVAGE_DEFAULTS[top] };
    applied.push(`${dotted} → default`);
    parsed = StoreSettingsSchema.safeParse(work);
  }

  if (!parsed.success) {
    logger.error(
      `[tenant] Schema validation failed for ${hostname} after ${applied.length} substitutions: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
    );
    return null;
  }

  logger.warn(
    `[tenant] Schema validation salvaged for ${hostname} with ${applied.length} field default(s): ${applied.join('; ')}`,
  );
  return parsed.data;
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
      const raw = (await response.json()) as Record<string, unknown>;
      const candidate = adaptMerchantApiResponse(raw);
      const settings = parseStoreSettingsResilient(candidate, hostname);
      if (settings) return buildTenantConfig(settings);
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
      // Geins out-of-box CMS slots + menus. Single source of truth —
      // see DEFAULT_CMS_CONFIG above. Tenants override by setting `cms`
      // on their stored StoreSettings.
      cms: DEFAULT_CMS_CONFIG,
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
