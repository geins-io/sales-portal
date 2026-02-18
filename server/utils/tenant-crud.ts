import type { TenantConfig } from '#shared/types/tenant-config';
import {
  createDefaultTheme,
  mergeThemes,
  buildDerivedTheme,
} from './tenant-css';
import {
  tenantIdKey,
  tenantConfigKey,
  collectAllHostnames,
  writeHostnameMappings,
  resolveTenant,
  DEFAULT_GEINS_SETTINGS,
} from './tenant';

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

  const { themeWithDerived, css, themeHash } = buildDerivedTheme(mergedTheme);

  const defaultConfig: TenantConfig = {
    tenantId: finalTenantId,
    hostname,
    geinsSettings: partialConfig?.geinsSettings ?? {
      ...DEFAULT_GEINS_SETTINGS,
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
    const updated = buildDerivedTheme(updatedTheme);
    const themeChanged = updated.themeHash !== existingConfig.themeHash;

    const updatedConfig: TenantConfig = {
      ...existingConfig,
      ...partialConfig,
      tenantId: finalTenantId,
      hostname,
      theme: updated.themeWithDerived,
      css: themeChanged ? updated.css : existingConfig.css,
      themeHash: updated.themeHash,
      updatedAt: new Date().toISOString(),
    };

    await storage.setItem(tenantConfigKey(finalTenantId), updatedConfig);
    await writeHostnameMappings(storage, updatedConfig);
    return updatedConfig;
  }

  return existingConfig;
}

/**
 * Updates an existing tenant configuration
 */
export async function updateTenant(
  hostname: string,
  updates: Partial<TenantConfig>,
  event?: import('h3').H3Event,
): Promise<TenantConfig | null> {
  const storage = useStorage('kv');
  const existing = await resolveTenant(hostname, event);

  if (!existing) {
    return null;
  }

  const updatedTheme = mergeThemes(existing.theme, updates.theme);
  const updated = buildDerivedTheme(updatedTheme);
  const themeChanged = updated.themeHash !== existing.themeHash;

  const updatedConfig: TenantConfig = {
    ...existing,
    ...updates,
    theme: updated.themeWithDerived,
    css: themeChanged ? updated.css : existing.css,
    themeHash: updated.themeHash,
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
    const tenantId = await storage.getItem<string>(tenantIdKey(hostname));
    const tid = tenantId || hostname;

    const config = await storage.getItem<TenantConfig>(tenantConfigKey(tid));

    if (config) {
      const hostnames = collectAllHostnames(config);
      await Promise.all(
        [...hostnames].map((h) => storage.removeItem(tenantIdKey(h))),
      );
    } else {
      await storage.removeItem(tenantIdKey(hostname));
    }

    await storage.removeItem(tenantConfigKey(tid));
    if (tid !== hostname) {
      await storage.removeItem(tenantConfigKey(hostname));
    }

    return true;
  } catch {
    return false;
  }
}
