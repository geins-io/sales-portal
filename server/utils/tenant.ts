import type { H3Event } from 'h3';
import type { TenantConfig } from '#shared/types/tenant-config';
import type {
  StoreSettings,
  ThemeColors,
  ThemeTypography,
} from '../schemas/store-settings';
import { StoreSettingsSchema } from '../schemas/store-settings';
import { deriveThemeColors, type FullThemeColors } from './theme';
import { KV_STORAGE_KEYS } from '#shared/constants/storage';
import { escapeCssString } from './sanitize';
import { logger } from './logger';

/**
 * Negative cache — hostnames that resolved to inactive/missing tenants.
 * Prevents thundering herd of API calls for unknown hostnames (bots, scanners).
 * Entries expire after NEGATIVE_CACHE_TTL_MS.
 */
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
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
  negativeCache.set(hostname, Date.now() + NEGATIVE_CACHE_TTL_MS);
}

/** Clears negative cache entries for a hostname (called on webhook invalidation). */
export function clearNegativeCache(hostname: string): void {
  negativeCache.delete(hostname);
}

/**
 * Storage key generators for tenant data
 */
export function tenantIdKey(hostname: string): string {
  return `${KV_STORAGE_KEYS.TENANT_ID_PREFIX}${hostname}`;
}

export function tenantConfigKey(tenantId: string): string {
  return `${KV_STORAGE_KEYS.TENANT_CONFIG_PREFIX}${tenantId}`;
}

/**
 * Default 6 core colors (shadcn zinc theme)
 */
const DEFAULT_CORE_COLORS: Pick<
  ThemeColors,
  | 'primary'
  | 'primaryForeground'
  | 'secondary'
  | 'secondaryForeground'
  | 'background'
  | 'foreground'
> = {
  primary: 'oklch(0.205 0 0)',
  primaryForeground: 'oklch(0.985 0 0)',
  secondary: 'oklch(0.97 0 0)',
  secondaryForeground: 'oklch(0.205 0 0)',
  background: 'oklch(1 0 0)',
  foreground: 'oklch(0.145 0 0)',
};

/**
 * CSS property name mapping for all 32 theme color keys
 */
const COLOR_CSS_MAP: Record<keyof FullThemeColors, string> = {
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  chart1: '--chart-1',
  chart2: '--chart-2',
  chart3: '--chart-3',
  chart4: '--chart-4',
  chart5: '--chart-5',
  sidebar: '--sidebar',
  sidebarForeground: '--sidebar-foreground',
  sidebarPrimary: '--sidebar-primary',
  sidebarPrimaryForeground: '--sidebar-primary-foreground',
  sidebarAccent: '--sidebar-accent',
  sidebarAccentForeground: '--sidebar-accent-foreground',
  sidebarBorder: '--sidebar-border',
  sidebarRing: '--sidebar-ring',
};

/**
 * Generates CSS custom properties from a full set of derived colors
 */
function generateColorCss(
  colors: FullThemeColors,
  indent: string = '  ',
): string {
  const lines: string[] = [];
  for (const [key, cssVar] of Object.entries(COLOR_CSS_MAP)) {
    const value = colors[key as keyof FullThemeColors];
    if (value) {
      lines.push(`${indent}${cssVar}: ${value};`);
    }
  }
  return lines.join('\n');
}

/**
 * Generates the base radius CSS variable.
 * Tailwind's @theme inline handles sm/md/lg/xl via calc(var(--radius) - Npx).
 */
function generateRadiusCss(radius: string, indent: string = '  '): string {
  return `${indent}--radius: ${radius};`;
}

/**
 * Generates font-family CSS custom properties from typography config.
 * Emits --font-family, --heading-font-family, --mono-font-family.
 */
export function generateFontCss(
  typography?: ThemeTypography | null,
  indent: string = '  ',
): string {
  if (!typography) return '';

  const lines: string[] = [];

  if (typography.fontFamily) {
    const safe = escapeCssString(typography.fontFamily);
    lines.push(
      `${indent}--font-family: '${safe}', ui-sans-serif, system-ui, sans-serif;`,
    );
  }

  const headingFamily = typography.headingFontFamily ?? typography.fontFamily;
  if (headingFamily) {
    const safe = escapeCssString(headingFamily);
    lines.push(
      `${indent}--heading-font-family: '${safe}', ui-sans-serif, system-ui, sans-serif;`,
    );
  }

  if (typography.monoFontFamily) {
    const safe = escapeCssString(typography.monoFontFamily);
    lines.push(
      `${indent}--mono-font-family: '${safe}', ui-monospace, 'SFMono-Regular', monospace;`,
    );
  }

  return lines.join('\n');
}

/**
 * Generates CSS custom properties from override CSS map
 */
export function generateOverrideCss(
  css?: Record<string, string> | null,
  indent: string = '  ',
): string {
  if (!css) return '';
  return Object.entries(css)
    .map(([prop, value]) => `${indent}${prop}: ${value};`)
    .join('\n');
}

/**
 * Generates a hash string from a theme object for comparison.
 * Used to determine if CSS needs to be regenerated.
 */
export function generateThemeHash(theme: TenantConfig['theme']): string {
  const sortedStringify = (obj: unknown): string => {
    return JSON.stringify(obj, (_, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce(
            (sorted, key) => {
              sorted[key] = value[key];
              return sorted;
            },
            {} as Record<string, unknown>,
          );
      }
      return value;
    });
  };
  return sortedStringify(theme);
}

/**
 * Generates complete CSS for a tenant theme.
 * Colors are the full 32-color set (already derived), radius generates variants,
 * and override CSS vars are appended.
 */
export function generateTenantCss(
  themeName: string,
  derivedColors: FullThemeColors,
  radius?: string | null,
  overrideCss?: Record<string, string> | null,
  typography?: ThemeTypography | null,
): string {
  const lines: string[] = [];

  lines.push(`[data-theme='${themeName}'] {`);
  lines.push(generateColorCss(derivedColors));

  if (radius) {
    lines.push(generateRadiusCss(radius));
  }

  const fontCss = generateFontCss(typography);
  if (fontCss) {
    lines.push(fontCss);
  }

  const overrides = generateOverrideCss(overrideCss);
  if (overrides) {
    lines.push(overrides);
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Creates a default theme for development/auto-created tenants
 */
export function createDefaultTheme(tenantId: string): TenantConfig['theme'] {
  return {
    name: tenantId.toLowerCase(),
    displayName: tenantId,
    colors: {
      ...DEFAULT_CORE_COLORS,
      card: null,
      cardForeground: null,
      popover: null,
      popoverForeground: null,
      muted: null,
      mutedForeground: null,
      accent: null,
      accentForeground: null,
      destructive: null,
      destructiveForeground: null,
      border: null,
      input: null,
      ring: null,
      chart1: null,
      chart2: null,
      chart3: null,
      chart4: null,
      chart5: null,
      sidebar: null,
      sidebarForeground: null,
      sidebarPrimary: null,
      sidebarPrimaryForeground: null,
      sidebarAccent: null,
      sidebarAccentForeground: null,
      sidebarBorder: null,
      sidebarRing: null,
    },
    radius: '0.625rem',
  };
}

/**
 * Merges a base theme with partial theme updates.
 */
export function mergeThemes(
  base: TenantConfig['theme'],
  updates?: Partial<TenantConfig['theme']>,
): TenantConfig['theme'] {
  if (!updates) return base;
  return {
    ...base,
    ...updates,
    colors: { ...base.colors, ...updates.colors },
    typography:
      updates.typography !== undefined ? updates.typography : base.typography,
  };
}

/**
 * Builds a TenantConfig from validated StoreSettings.
 * Derives colors, merges override features, generates CSS + hash.
 */
function buildTenantConfig(settings: StoreSettings): TenantConfig {
  // Derive all 32 colors from the 6 core + any provided optional
  const derivedColors = deriveThemeColors(settings.theme.colors);

  // Merge override features into base features
  const features = { ...settings.features };
  if (settings.overrides?.features) {
    for (const [key, value] of Object.entries(settings.overrides.features)) {
      features[key] = value;
    }
  }

  // Generate CSS with derived colors + override CSS vars + typography
  const css = generateTenantCss(
    settings.theme.name,
    derivedColors,
    settings.theme.radius,
    settings.overrides?.css,
    settings.theme.typography,
  );

  // Build theme with derived colors replacing original
  const theme: TenantConfig['theme'] = {
    ...settings.theme,
    colors: derivedColors,
  };

  const themeHash = generateThemeHash(theme);

  return {
    tenantId: settings.tenantId,
    hostname: settings.hostname,
    aliases: settings.aliases,
    geinsSettings: settings.geinsSettings,
    mode: settings.mode,
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

export interface CreateTenantOptions {
  hostname: string;
  tenantId?: string;
  config?: Partial<TenantConfig>;
}

/**
 * Creates or updates a tenant configuration in KV storage.
 */
export async function createTenant(
  options: CreateTenantOptions,
): Promise<TenantConfig> {
  const { hostname, tenantId, config: partialConfig } = options;
  const storage = useStorage('kv');
  const finalTenantId = tenantId || hostname;

  const defaultTheme = createDefaultTheme(finalTenantId);
  const mergedTheme = mergeThemes(defaultTheme, partialConfig?.theme);

  // Derive colors and generate CSS
  const derivedColors = deriveThemeColors(mergedTheme.colors as ThemeColors);
  const css = generateTenantCss(
    mergedTheme.name,
    derivedColors,
    mergedTheme.radius,
    undefined,
    mergedTheme.typography,
  );
  const themeWithDerived = {
    ...mergedTheme,
    colors: derivedColors as Record<string, string>,
  };
  const themeHash = generateThemeHash(themeWithDerived);

  const defaultConfig: TenantConfig = {
    tenantId: finalTenantId,
    hostname,
    geinsSettings: partialConfig?.geinsSettings ?? {
      apiKey: '',
      accountName: '',
      channel: '1',
      tld: 'se',
      locale: 'sv-SE',
      market: 'se',
      environment: 'production' as const,
      availableLocales: ['sv-SE'],
      availableMarkets: ['se'],
    },
    mode: partialConfig?.mode ?? 'commerce',
    theme: themeWithDerived,
    css,
    themeHash,
    branding: partialConfig?.branding ?? {
      name: finalTenantId,
      watermark: 'full',
    },
    features: partialConfig?.features ?? {
      search: { enabled: true },
      cart: { enabled: true },
    },
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const finalConfig: TenantConfig = {
    ...defaultConfig,
    ...partialConfig,
    theme: themeWithDerived,
    css,
    themeHash,
  };

  const existingConfig = await storage.getItem<TenantConfig>(
    tenantConfigKey(finalTenantId),
  );

  if (!existingConfig) {
    await storage.setItem(tenantConfigKey(finalTenantId), finalConfig);
    await writeHostnameMappings(storage, finalConfig);
    return finalConfig;
  }

  if (partialConfig) {
    const updatedTheme = mergeThemes(existingConfig.theme, partialConfig.theme);
    const updatedDerived = deriveThemeColors(
      updatedTheme.colors as ThemeColors,
    );
    const updatedThemeWithDerived = {
      ...updatedTheme,
      colors: updatedDerived as Record<string, string>,
    };
    const newThemeHash = generateThemeHash(updatedThemeWithDerived);
    const themeChanged = newThemeHash !== existingConfig.themeHash;

    const updatedConfig: TenantConfig = {
      ...existingConfig,
      ...partialConfig,
      tenantId: finalTenantId,
      hostname,
      theme: updatedThemeWithDerived,
      css: themeChanged
        ? generateTenantCss(
            updatedThemeWithDerived.name,
            updatedDerived,
            updatedThemeWithDerived.radius,
            undefined,
            updatedThemeWithDerived.typography,
          )
        : existingConfig.css,
      themeHash: newThemeHash,
      updatedAt: new Date().toISOString(),
    };

    await storage.setItem(tenantConfigKey(finalTenantId), updatedConfig);
    await writeHostnameMappings(storage, updatedConfig);
    return updatedConfig;
  }

  return existingConfig;
}

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

      // Transform platform-injected geinsSettings → our clean internal shape.
      // Platform sends: channelId ("2|se"), defaultLocale, defaultMarket, locales[], markets[]
      // We need: channel, tld, locale, market, availableLocales[], availableMarkets[]
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

      // Validation failed — log and fall through
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
    const derivedColors = deriveThemeColors(defaultTheme.colors as ThemeColors);
    const themeWithDerived = {
      ...defaultTheme,
      colors: derivedColors as Record<string, string>,
    };

    return {
      tenantId: hostname,
      hostname,
      geinsSettings: {
        apiKey: '',
        accountName: '',
        channel: '1',
        tld: 'se',
        locale: 'sv-SE',
        market: 'se',
        environment: 'production' as const,
        availableLocales: ['sv-SE'],
        availableMarkets: ['se'],
      },
      mode: 'commerce',
      theme: themeWithDerived,
      css: generateTenantCss(
        themeWithDerived.name,
        derivedColors,
        themeWithDerived.radius,
        undefined,
        themeWithDerived.typography,
      ),
      branding: {
        name: hostname,
        watermark: 'full',
      },
      features: {
        search: { enabled: true },
        authentication: { enabled: true },
        cart: { enabled: true },
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
    geinsSettings: {
      apiKey: '',
      accountName: '',
      channel: '1',
      tld: 'se',
      locale: 'sv-SE',
      market: 'se',
      environment: 'production' as const,
      availableLocales: ['sv-SE'],
      availableMarkets: ['se'],
    },
    mode: 'commerce',
    theme: createDefaultTheme(hostname),
    css: '',
    branding: {
      name: 'not-found',
      watermark: 'none',
    },
    features: {},
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

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
 */
export async function writeHostnameMappings(
  storage: ReturnType<typeof useStorage>,
  config: TenantConfig,
): Promise<void> {
  const hostnames = collectAllHostnames(config);
  const tid = config.tenantId;
  await Promise.all(
    [...hostnames].map((h) => storage.setItem(tenantIdKey(h), tid)),
  );
}

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
  // Short-circuit for hostnames recently resolved as inactive/missing
  if (isNegativelyCached(hostname)) return null;

  const storage = useStorage('kv');

  // Step 1: hostname → tenantId
  const tenantId = await storage.getItem<string>(tenantIdKey(hostname));

  if (tenantId) {
    // Step 2: tenantId → config
    const config = await getTenantById(tenantId);
    if (config) return config;
  }

  // Backwards compat: check for legacy tenant:config:{hostname}
  const legacyConfig = await storage.getItem<TenantConfig>(
    tenantConfigKey(hostname),
  );
  if (legacyConfig && legacyConfig.isActive) {
    // Migrate: write proper hostname mappings + config under tenantId
    const tid = legacyConfig.tenantId || hostname;
    if (tid !== hostname) {
      // Config was stored under hostname key — move it to tenantId key
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

/**
 * @deprecated Use `resolveTenant` instead. This alias exists for backwards compatibility.
 */
export const getTenant = resolveTenant;

/**
 * Updates an existing tenant configuration
 */
export async function updateTenant(
  hostname: string,
  updates: Partial<TenantConfig>,
  event?: H3Event,
): Promise<TenantConfig | null> {
  const storage = useStorage('kv');
  const existing = await resolveTenant(hostname, event);

  if (!existing) {
    return null;
  }

  const updatedTheme = mergeThemes(existing.theme, updates.theme);
  const updatedDerived = deriveThemeColors(updatedTheme.colors as ThemeColors);
  const updatedThemeWithDerived = {
    ...updatedTheme,
    colors: updatedDerived as Record<string, string>,
  };
  const newThemeHash = generateThemeHash(updatedThemeWithDerived);
  const themeChanged = newThemeHash !== existing.themeHash;

  const updatedConfig: TenantConfig = {
    ...existing,
    ...updates,
    theme: updatedThemeWithDerived,
    css: themeChanged
      ? generateTenantCss(
          updatedThemeWithDerived.name,
          updatedDerived,
          updatedThemeWithDerived.radius,
          undefined,
          updatedThemeWithDerived.typography,
        )
      : existing.css,
    themeHash: newThemeHash,
    updatedAt: new Date().toISOString(),
  };

  const tid = updatedConfig.tenantId || hostname;
  await storage.setItem(tenantConfigKey(tid), updatedConfig);
  await writeHostnameMappings(storage, updatedConfig);
  return updatedConfig;
}

/**
 * Deletes a tenant configuration and all associated hostname mappings.
 */
export async function deleteTenant(hostname: string): Promise<boolean> {
  const storage = useStorage('kv');

  try {
    // Look up tenantId first
    const tenantId = await storage.getItem<string>(tenantIdKey(hostname));
    const tid = tenantId || hostname;

    // Load config to find all hostnames
    const config = await storage.getItem<TenantConfig>(tenantConfigKey(tid));

    if (config) {
      // Remove all hostname → tenantId mappings
      const hostnames = collectAllHostnames(config);
      await Promise.all(
        [...hostnames].map((h) => storage.removeItem(tenantIdKey(h))),
      );
    } else {
      // No config found — at least remove the mapping for this hostname
      await storage.removeItem(tenantIdKey(hostname));
    }

    // Remove config (try both tenantId and hostname keys for legacy cleanup)
    await storage.removeItem(tenantConfigKey(tid));
    if (tid !== hostname) {
      await storage.removeItem(tenantConfigKey(hostname));
    }

    return true;
  } catch {
    return false;
  }
}
