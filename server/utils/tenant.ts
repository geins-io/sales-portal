import type {
  TenantConfig,
  TenantTheme,
  ThemeColors,
} from '#shared/types/tenant-config';
import { KV_STORAGE_KEYS } from '#shared/constants/storage';

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
 * Default theme colors following shadcn/ui conventions
 */
const DEFAULT_LIGHT_COLORS: ThemeColors = {
  primary: 'oklch(0.205 0 0)',
  primaryForeground: 'oklch(0.985 0 0)',
  secondary: 'oklch(0.97 0 0)',
  secondaryForeground: 'oklch(0.205 0 0)',
  background: 'oklch(1 0 0)',
  foreground: 'oklch(0.145 0 0)',
  muted: 'oklch(0.97 0 0)',
  mutedForeground: 'oklch(0.556 0 0)',
  accent: 'oklch(0.97 0 0)',
  accentForeground: 'oklch(0.205 0 0)',
  destructive: 'oklch(0.577 0.245 27.325)',
  border: 'oklch(0.922 0 0)',
  input: 'oklch(0.922 0 0)',
  ring: 'oklch(0.708 0 0)',
  card: 'oklch(1 0 0)',
  cardForeground: 'oklch(0.145 0 0)',
  popover: 'oklch(1 0 0)',
  popoverForeground: 'oklch(0.145 0 0)',
};

/**
 * CSS property name mapping for theme colors
 */
const COLOR_CSS_MAP: Record<keyof ThemeColors, string> = {
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  background: '--background',
  foreground: '--foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  border: '--border',
  input: '--input',
  ring: '--ring',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
};

/**
 * Generates CSS custom properties from theme colors
 */
function generateColorCss(
  colors: Partial<ThemeColors>,
  indent: string = '  ',
): string {
  const lines: string[] = [];
  for (const [key, cssVar] of Object.entries(COLOR_CSS_MAP)) {
    const value = colors[key as keyof ThemeColors];
    if (value) {
      lines.push(`${indent}${cssVar}: ${value};`);
    }
  }
  return lines.join('\n');
}

/**
 * Generates a hash string from a theme object for comparison.
 * Used to determine if CSS needs to be regenerated.
 */
export function generateThemeHash(theme: TenantTheme): string {
  // Create a stable JSON string for hashing
  // Use a replacer function to sort keys at all levels for consistent ordering
  const sortedStringify = (obj: unknown): string => {
    return JSON.stringify(obj, (_, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Sort object keys for consistent ordering
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
 * Generates complete CSS for a tenant theme
 */
export function generateTenantCss(theme: TenantTheme): string {
  const { name, colors, borderRadius, customProperties } = theme;
  const lines: string[] = [];

  lines.push(`[data-theme='${name}'] {`);
  lines.push(generateColorCss(colors));

  // Border radius
  if (borderRadius?.base) {
    lines.push(`  --radius: ${borderRadius.base};`);
  }

  // Custom properties
  if (customProperties) {
    for (const [prop, value] of Object.entries(customProperties)) {
      lines.push(`  ${prop}: ${value};`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Creates a default theme for a tenant
 */
export function createDefaultTheme(tenantId: string): TenantTheme {
  return {
    name: tenantId,
    displayName: tenantId,
    colors: { ...DEFAULT_LIGHT_COLORS },
    borderRadius: {
      base: '0.625rem',
    },
  };
}

/**
 * Merges a base theme with partial theme updates.
 * Deep merges all nested theme objects (colors, borderRadius, typography, customProperties)
 * to preserve existing values while applying updates.
 *
 * @param base - The base theme to merge into
 * @param updates - Optional partial theme updates to apply
 * @returns The merged theme
 */
export function mergeThemes(
  base: TenantTheme,
  updates?: Partial<TenantTheme>,
): TenantTheme {
  if (!updates) return base;
  return {
    ...base,
    ...updates,
    colors: { ...base.colors, ...updates.colors },
    borderRadius: { ...base.borderRadius, ...updates.borderRadius },
    typography: { ...base.typography, ...updates.typography },
    customProperties: { ...base.customProperties, ...updates.customProperties },
  };
}

export interface CreateTenantOptions {
  hostname: string;
  tenantId?: string;
  config?: Partial<TenantConfig>;
}

/**
 * Creates or updates a tenant configuration in KV storage.
 *
 * @param options - Options for creating the tenant
 * @param options.hostname - The hostname for the tenant (e.g., 'tenant-a.localhost')
 * @param options.tenantId - Optional tenant ID. If not provided, uses hostname as ID
 * @param options.config - Optional partial config. Missing values will use defaults
 * @returns The created or existing tenant configuration
 */
export async function createTenant(
  options: CreateTenantOptions,
): Promise<TenantConfig> {
  const { hostname, tenantId, config: partialConfig } = options;
  const storage = useStorage('kv');
  const finalTenantId = tenantId || hostname;

  // Create default theme
  const defaultTheme = createDefaultTheme(finalTenantId);

  // Merge theme if partial config provided
  const mergedTheme = mergeThemes(defaultTheme, partialConfig?.theme);

  // Generate theme hash and CSS
  const themeHash = generateThemeHash(mergedTheme);
  const css = generateTenantCss(mergedTheme);

  // Create default config
  const defaultConfig: TenantConfig = {
    tenantId: finalTenantId,
    hostname: hostname,
    theme: mergedTheme,
    css,
    themeHash,
    branding: {
      name: finalTenantId,
      ...partialConfig?.branding,
    },
    features: {
      search: true,
      authentication: true,
      cart: true,
      ...partialConfig?.features,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Merge with provided config
  const finalConfig: TenantConfig = {
    ...defaultConfig,
    ...partialConfig,
    theme: mergedTheme,
    css,
    themeHash,
  };

  // Check if tenant mapping already exists
  const existingId = await storage.getItem<string>(tenantIdKey(hostname));

  if (!existingId) {
    // Map hostname to tenant ID
    await storage.setItem(tenantIdKey(hostname), finalTenantId);
  }

  // Check if tenant config exists
  const existingConfig = await storage.getItem<TenantConfig>(
    tenantConfigKey(finalTenantId),
  );

  if (!existingConfig) {
    // Create new tenant config
    await storage.setItem(tenantConfigKey(finalTenantId), finalConfig);
    return finalConfig;
  }

  // If config exists but we want to update it, merge and save
  if (partialConfig) {
    const updatedTheme = mergeThemes(existingConfig.theme, partialConfig.theme);

    // Only regenerate CSS if theme has changed (hash comparison)
    const newThemeHash = generateThemeHash(updatedTheme);
    const existingThemeHash = existingConfig.themeHash;
    const themeChanged = newThemeHash !== existingThemeHash;

    const updatedConfig: TenantConfig = {
      ...existingConfig,
      ...partialConfig,
      tenantId: finalTenantId,
      hostname: hostname,
      theme: updatedTheme,
      css: themeChanged ? generateTenantCss(updatedTheme) : existingConfig.css,
      themeHash: newThemeHash,
      updatedAt: new Date().toISOString(),
    };

    await storage.setItem(tenantConfigKey(finalTenantId), updatedConfig);
    return updatedConfig;
  }

  // If config exists but we don't want to update it, return the existing config
  return existingConfig;
}

export async function fetchTenantConfig(
  tenantId: string,
): Promise<TenantConfig | null> {
  const config = useRuntimeConfig();

  // Return null if tenant API is not configured
  if (!config.geins.tenantApiUrl) {
    return null;
  }

  const response = await fetch(
    `${config.geins.tenantApiUrl}/tenant?tenantId=${tenantId}`,
    {
      headers: {
        'x-api-key': config.geins.tenantApiKey,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    return null;
  }
  return response.json();
}
/**
 * Retrieves a tenant configuration from KV storage
 */
export async function getTenant(
  tenantId: string,
): Promise<TenantConfig | null> {
  const storage = useStorage('kv');
  const tenantConfig = await storage.getItem<TenantConfig>(
    tenantConfigKey(tenantId),
  );
  if (!tenantConfig) {
    const newTenantConfig = await fetchTenantConfig(tenantId);
    if (!newTenantConfig) {
      return null;
    }
    // Cache the fetched config in KV storage
    const configToCache: TenantConfig = {
      ...newTenantConfig,
      isActive: true,
    };
    await storage.setItem(tenantConfigKey(tenantId), configToCache);
    return configToCache;
  }
  if (!tenantConfig.isActive) {
    return null;
  }
  return tenantConfig;
}

/**
 * Retrieves a tenant by hostname
 */
export async function getTenantByHostname(
  hostname: string,
): Promise<TenantConfig | null> {
  const storage = useStorage('kv');
  const tenantId = await storage.getItem<string>(tenantIdKey(hostname));

  if (!tenantId) {
    return null;
  }

  return getTenant(tenantId);
}

/**
 * Updates an existing tenant configuration
 */
export async function updateTenant(
  tenantId: string,
  updates: Partial<TenantConfig>,
): Promise<TenantConfig | null> {
  const storage = useStorage('kv');
  const existing = await getTenant(tenantId);

  if (!existing) {
    return null;
  }

  // Merge theme updates using the utility function
  const updatedTheme = mergeThemes(existing.theme, updates.theme);

  // Only regenerate CSS if theme has changed (hash comparison)
  const newThemeHash = generateThemeHash(updatedTheme);
  const existingThemeHash = existing.themeHash;
  const themeChanged = newThemeHash !== existingThemeHash;

  const updatedConfig: TenantConfig = {
    ...existing,
    ...updates,
    theme: updatedTheme,
    css: themeChanged ? generateTenantCss(updatedTheme) : existing.css,
    themeHash: newThemeHash,
    updatedAt: new Date().toISOString(),
  };

  await storage.setItem(tenantConfigKey(tenantId), updatedConfig);
  return updatedConfig;
}

/**
 * Deletes a tenant configuration
 */
export async function deleteTenant(
  tenantId: string,
  hostname: string,
): Promise<boolean> {
  const storage = useStorage('kv');

  try {
    await storage.removeItem(tenantIdKey(hostname));
    await storage.removeItem(tenantConfigKey(tenantId));
    return true;
  } catch {
    return false;
  }
}
