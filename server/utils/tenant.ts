import type { H3Event } from 'h3';
import type { TenantConfig } from '#shared/types/tenant-config';
import { CMS_SLOTS } from '#shared/types/cms-slots';
import { CMS_MENUS } from '#shared/constants/cms';
import type {
  StoreSettings,
  GeinsSettings,
  FeatureConfig,
} from '../schemas/store-settings';
import { StoreSettingsSchema } from '../schemas/store-settings';
import { deriveThemeColors } from './theme';
import {
  STOREFRONT_SETTINGS_DEFAULTS,
  mergeStorefrontSettings,
} from './storefront-settings-defaults';
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
    [CMS_SLOTS.APPLY_FOR_ACCOUNT]: {
      family: 'Infopage',
      areaName: 'Account application',
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
  // Per-field deep merge of canonical defaults under the API response.
  // Missing keys inherit; explicit "" / false / null from API win. See
  // server/utils/storefront-settings-defaults.ts for the canonical shape.
  const merged = mergeStorefrontSettings(settings);

  const derivedColors = deriveThemeColors(merged.theme.colors);

  // Portal feature flag layer. The canonical defaults already live in
  // STOREFRONT_SETTINGS_DEFAULTS.features (priceVisibility, orderPlacement,
  // stockStatus carry the {enabled, access} shape; the other 11 portal
  // features default to {enabled: true}). overrides.features takes final
  // precedence below.
  const features: Record<string, FeatureConfig> = {
    ...STOREFRONT_SETTINGS_DEFAULTS.features,
    ...merged.features,
  };
  if (merged.overrides?.features) {
    for (const [key, value] of Object.entries(merged.overrides.features)) {
      features[key] = value;
    }
  }

  const themeName = merged.theme.name ?? merged.tenantId;

  const css = generateTenantCss(
    themeName,
    derivedColors,
    merged.theme.radius,
    merged.overrides?.css,
    merged.theme.typography,
  );

  const theme: TenantConfig['theme'] = {
    ...merged.theme,
    name: themeName,
    colors: derivedColors,
  };

  const themeHash = generateThemeHash(theme);

  // Guarantee a non-empty branding.name. Canonical defaults may ship an
  // empty string for `name`; fall back to channel `accountName`, then to
  // hostname. The topbar avatar, hero heading, and footer copyright all
  // consume this value directly.
  const brandingName =
    merged.branding?.name?.trim() ||
    merged.geinsSettings.accountName?.trim() ||
    merged.hostname;
  const branding = { ...merged.branding, name: brandingName };

  // CMS: explicit tenant config wins, otherwise fall back to the standard
  // Geins out-of-box family/areaName values + menu locations. Lets every
  // tenant render slots/menus without per-tenant overrides.
  const cms =
    (merged as { cms?: TenantConfig['cms'] }).cms ?? DEFAULT_CMS_CONFIG;

  return {
    tenantId: merged.tenantId,
    hostname: merged.hostname,
    aliases: merged.aliases,
    geinsSettings: merged.geinsSettings,
    mode: merged.mode,
    checkoutMode: merged.checkoutMode,
    theme,
    branding,
    features,
    seo: merged.seo,
    contact: merged.contact,
    overrides: merged.overrides,
    cms,
    css,
    themeHash,
    isActive: merged.isActive,
    createdAt: merged.createdAt,
    updatedAt: merged.updatedAt,
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mergeDeep(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const b = base[key];
    const o = override[key];
    result[key] = isPlainObject(b) && isPlainObject(o) ? mergeDeep(b, o) : o;
  }
  return result;
}

/**
 * Six required core OKLCH keys the storefront cannot render without.
 * Missing values are backfilled from `createDefaultTheme(hostname)` after a
 * successful parse so a tenant that only saved surface colors in admin still
 * boots with a sensible palette.
 */
const CORE_COLOR_KEYS = [
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'background',
  'foreground',
] as const;

/**
 * Walks a path of object keys / array indices and deletes the leaf.
 * Array indices use `splice` so we don't leave a hole that breaks `.length`.
 * Returns true if a leaf was actually removed.
 */
const FORBIDDEN_PATH_SEGMENTS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

export function deleteAtPath(
  root: unknown,
  path: ReadonlyArray<string | number>,
): boolean {
  if (path.length === 0 || root === null || typeof root !== 'object') {
    return false;
  }
  // Defense-in-depth: refuse to walk segments that could touch the
  // prototype chain. The schema is currently `.strict()` so Zod won't emit
  // such paths, but a future switch to `.passthrough()` / `.catchall()`
  // could let attacker-controlled keys reach this helper.
  for (const segment of path) {
    if (typeof segment === 'string' && FORBIDDEN_PATH_SEGMENTS.has(segment)) {
      return false;
    }
  }
  let cursor: unknown = root;
  for (let i = 0; i < path.length - 1; i++) {
    if (cursor === null || typeof cursor !== 'object') return false;
    const segment = path[i] as string | number;
    cursor = (cursor as Record<string | number, unknown>)[segment];
  }
  if (cursor === null || typeof cursor !== 'object') return false;
  const leaf = path[path.length - 1] as string | number;
  if (Array.isArray(cursor) && typeof leaf === 'number') {
    if (leaf < 0 || leaf >= cursor.length) return false;
    cursor.splice(leaf, 1);
    return true;
  }
  const container = cursor as Record<string | number, unknown>;
  if (!(leaf in container)) return false;
  // Reflect.deleteProperty (vs. `delete container[leaf]`) sidesteps the
  // no-dynamic-delete lint; the salvager walks Zod-issue paths whose
  // leaves are inherently dynamic.
  return Reflect.deleteProperty(container, leaf as PropertyKey);
}

/**
 * Fills any missing core OKLCH colors on `theme.colors` from
 * `createDefaultTheme(hostname).colors`. Existing values (including the
 * caller's intentional non-default values) are left untouched. Returns the
 * list of keys that were backfilled so callers can log the diff.
 */
export function backfillCoreColors(
  theme: StoreSettings['theme'],
  hostname: string,
): readonly (typeof CORE_COLOR_KEYS)[number][] {
  const defaults = createDefaultTheme(hostname).colors;
  const filled: (typeof CORE_COLOR_KEYS)[number][] = [];
  for (const key of CORE_COLOR_KEYS) {
    if (theme.colors[key] === undefined) {
      // Core keys in DEFAULT_CORE_COLORS are always non-null strings; the
      // widened type permits null because surface keys can be null.
      const value = defaults[key];
      if (typeof value === 'string') {
        theme.colors[key] = value;
        filled.push(key);
      }
    }
  }
  return filled;
}

/**
 * Pick a sensible default branding name from a candidate StoreSettings.
 * Order: `geinsSettings.accountName` (trimmed, non-empty) → hostname.
 *
 * Used by the salvage path when the API ships no usable `branding` block,
 * and by `buildTenantConfig` when the merged branding name is empty.
 * Avoids rendering a generic literal in the topbar avatar, hero heading,
 * or footer copyright.
 */
export function defaultBrandingName(
  candidate: Record<string, unknown>,
  hostname: string,
): string {
  const gs = candidate.geinsSettings;
  if (gs && typeof gs === 'object') {
    const name = (gs as Record<string, unknown>).accountName;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return hostname;
}

/**
 * Parse a candidate StoreSettings tolerantly.
 *
 * Strict `StoreSettingsSchema.safeParse` is the happy path. When the merchant
 * API ships unexpected data the parser walks a three-stage salvage so a tenant
 * never blanks because of presentation config drift:
 *
 *   1. Top-level substitute. If a Zod issue's path is a single segment and
 *      the field has a SALVAGE_DEFAULTS entry, swap the whole top-level value
 *      for the conservative default (merged deeply with the existing value
 *      when both are plain objects). Bounded by MAX_SUBSTITUTIONS.
 *
 *   2. Deep leaf-strip. If the issue path is longer than one segment, delete
 *      the single failing leaf from the working object via path-walk and
 *      re-parse. Lets ~30 bad surface colors evaporate without burning the
 *      top-level substitution budget. Bounded by MAX_LEAF_STRIPS. Stripped
 *      paths are recorded in `seenPaths` so a logic bug can't loop on the
 *      same key.
 *
 *   3. Core-color backfill. After a successful parse, any of the six required
 *      core OKLCH keys still missing from `theme.colors` get filled from
 *      `createDefaultTheme(hostname).colors`. This is what guarantees that
 *      a payload with empty / missing / garbage `theme.colors` still produces
 *      a renderable tenant. Color values are presentation data, never fatal.
 *
 * FATAL_PATHS (e.g. `tenantId`, `geinsSettings.apiKey`) bypass all salvage
 * and return null so we never serve a tenant claiming wrong credentials.
 */
export function parseStoreSettingsResilient(
  candidate: unknown,
  hostname: string,
): StoreSettings | null {
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
    // `theme` intentionally omitted: it's computed lazily from
    // `createDefaultTheme(hostname)` at substitution time so the salvage
    // palette can't drift from the canonical default.
    // `branding.name` is intentionally omitted: it's computed lazily from
    // `defaultBrandingName(work, hostname)` at substitution time so a tenant
    // never renders a generic literal in the topbar/hero/footer.
    branding: {
      watermark: 'full',
    },
    features: {},
  };
  const FATAL_PATHS = new Set([
    'tenantId',
    'hostname',
    'geinsSettings',
    'geinsSettings.apiKey',
    'geinsSettings.accountName',
  ]);

  const MAX_SUBSTITUTIONS = 12;
  // ThemeColorsSchema declares ~40 color keys (6 core + 26 optional + 8
  // surface). 64 gives comfortable headroom for "every declared color value
  // is garbage" plus a few unknown keys, so the hard guarantee that no
  // combination of color inputs blanks a tenant holds at full strength.
  const MAX_LEAF_STRIPS = 64;

  // Deep-clone so the salvage loop can mutate (deleteAtPath splices arrays
  // and deletes object keys). `structuredClone` preserves Date, Map, Set,
  // typed arrays, etc., where a JSON round-trip would silently lose them,
  // and it's a touch faster than JSON.parse(JSON.stringify(...)) on the
  // payloads we see in practice. Node 20+ provides it natively.
  let work: Record<string, unknown> = structuredClone(candidate) as Record<
    string,
    unknown
  >;
  let parsed = StoreSettingsSchema.safeParse(work);
  if (parsed.success) {
    const filled = backfillCoreColors(parsed.data.theme, hostname);
    if (filled.length > 0) {
      logger.warn(
        `[tenant] Backfilled ${filled.length} missing core color(s) for ${hostname}: ${filled.join(', ')}`,
      );
    }
    return parsed.data;
  }

  const substituted: string[] = [];
  const strippedLeaves: string[] = [];
  const seenStripPaths = new Set<string>();
  let substitutions = 0;
  let leafStrips = 0;

  while (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (!issue) break;
    const dotted = issue.path.map(String).join('.');
    const top = String(issue.path[0] ?? '');

    if (!top || FATAL_PATHS.has(dotted) || FATAL_PATHS.has(top)) {
      logger.error(
        `[tenant] Schema validation failed for ${hostname} on a fatal path (${dotted}): ${issue.message}`,
      );
      return null;
    }

    if (issue.path.length > 1) {
      // Deep failure: strip the single bad leaf instead of replacing the
      // whole top-level container. Required-but-missing keys (e.g. the six
      // core colors) are NOT salvaged here; they fall through to the
      // top-level substitute path which carries a complete theme default,
      // or to the post-parse backfill once a parse succeeds.
      const stripPath = issue.path.filter(
        (p): p is string | number =>
          typeof p === 'string' || typeof p === 'number',
      );
      const stripped = deleteAtPath(work, stripPath);
      if (stripped) {
        if (seenStripPaths.has(dotted)) {
          // Same leaf re-emerged after we already removed it. Indicates a
          // logic bug or a Zod re-emission loop; bail to avoid spinning.
          logger.error(
            `[tenant] Schema validation for ${hostname} did not converge on path ${dotted} after strip`,
          );
          return null;
        }
        seenStripPaths.add(dotted);
        strippedLeaves.push(dotted);
        leafStrips++;
        if (leafStrips > MAX_LEAF_STRIPS) {
          logger.error(
            `[tenant] Schema validation for ${hostname} exceeded ${MAX_LEAF_STRIPS} leaf strips; giving up`,
          );
          return null;
        }
        parsed = StoreSettingsSchema.safeParse(work);
        continue;
      }
      // Leaf wasn't actually present (missing required field). Fall through
      // to top-level substitution so the SALVAGE_DEFAULTS theme/branding/etc
      // can fill the gap.
    }

    const hasSalvage = top === 'theme' || top in SALVAGE_DEFAULTS;
    if (!hasSalvage) {
      logger.error(
        `[tenant] Schema validation failed for ${hostname} (${dotted}): ${issue.message}; no salvage default`,
      );
      return null;
    }
    const existing = work[top];
    // `theme` is computed lazily from `createDefaultTheme(hostname)` so the
    // salvage palette is always the canonical default for this hostname.
    // `branding.name` is computed lazily from the candidate's
    // `geinsSettings.accountName` (or hostname) so a tenant never renders a
    // generic literal in the topbar/hero/footer.
    let salvage: unknown;
    if (top === 'theme') {
      salvage = { colors: createDefaultTheme(hostname).colors };
    } else if (top === 'branding') {
      salvage = {
        ...(SALVAGE_DEFAULTS.branding as Record<string, unknown>),
        name: defaultBrandingName(work, hostname),
      };
    } else {
      salvage = SALVAGE_DEFAULTS[top];
    }
    work = {
      ...work,
      [top]:
        isPlainObject(existing) && isPlainObject(salvage)
          ? mergeDeep(salvage as Record<string, unknown>, existing)
          : salvage,
    };
    substituted.push(`${dotted} → default`);
    substitutions++;
    if (substitutions > MAX_SUBSTITUTIONS) {
      logger.error(
        `[tenant] Schema validation for ${hostname} exceeded ${MAX_SUBSTITUTIONS} top-level substitutions; giving up`,
      );
      return null;
    }
    parsed = StoreSettingsSchema.safeParse(work);
  }

  if (!parsed.success) {
    logger.error(
      `[tenant] Schema validation failed for ${hostname} after ${substituted.length} substitution(s) and ${strippedLeaves.length} leaf-strip(s): ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
    );
    return null;
  }

  const filled = backfillCoreColors(parsed.data.theme, hostname);

  if (substituted.length || strippedLeaves.length || filled.length) {
    const parts: string[] = [];
    if (substituted.length)
      parts.push(
        `${substituted.length} substitution(s): ${substituted.join('; ')}`,
      );
    if (strippedLeaves.length)
      parts.push(
        `${strippedLeaves.length} leaf-strip(s): ${strippedLeaves.join('; ')}`,
      );
    if (filled.length)
      parts.push(`${filled.length} core backfill(s): ${filled.join(', ')}`);
    logger.warn(
      `[tenant] Schema salvaged for ${hostname}: ${parts.join(' | ')}`,
    );
  }

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
        applyForAccount: { enabled: true },
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
