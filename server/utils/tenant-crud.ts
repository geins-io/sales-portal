import type {
  TenantConfig,
  CmsConfigUpdate,
} from '#shared/types/tenant-config';
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
  defaultGeinsSettings,
  invalidateTenantCaches,
  withTenantConfigDefaults,
} from './tenant';
import { withoutUndefined } from './object';

/**
 * A partial tenant update as accepted by createTenant/updateTenant: every
 * field is optional like `Partial<TenantConfig>`, except `cms`, whose
 * update shape additionally allows `null` per slot/menu key to mean
 * "remove this key" — see CmsConfigUpdate.
 */
export type TenantConfigUpdate = Omit<Partial<TenantConfig>, 'cms'> & {
  cms?: CmsConfigUpdate;
};

export interface CreateTenantOptions {
  hostname: string;
  tenantId?: string;
  config?: TenantConfigUpdate;
}

/**
 * Merges a `cms` update onto a base `cms` config, per slot/menu key:
 * a key present in `partial` overwrites that key alone (siblings and the
 * other of slots/menus are untouched), a key set to `null` removes it,
 * and an absent `partial` (or an absent `slots`/`menus` sub-object)
 * leaves the corresponding base entirely unchanged — the same
 * omit-means-untouched contract every other tenant config field gets
 * from mergeTenantConfig, just applied one level deeper since `cms` is
 * itself a keyed map rather than a fixed set of named fields.
 */
export function mergeCmsConfig(
  base: TenantConfig['cms'],
  partial: CmsConfigUpdate | undefined,
): TenantConfig['cms'] {
  if (!partial) return base;

  function mergeMap<T>(
    baseMap: Partial<Record<string, T>> | undefined,
    partialMap: Partial<Record<string, T | null>> | undefined,
  ): Partial<Record<string, T>> | undefined {
    if (!partialMap) return baseMap;
    const result: Partial<Record<string, T>> = { ...baseMap };
    for (const [key, value] of Object.entries(partialMap)) {
      if (value === null) {
        Reflect.deleteProperty(result, key);
      } else if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  const slots = mergeMap(base?.slots, partial.slots);
  const menus = mergeMap(base?.menus, partial.menus);

  if (slots === undefined && menus === undefined) return base;
  return {
    ...(slots !== undefined ? { slots } : {}),
    ...(menus !== undefined ? { menus } : {}),
  };
}

/**
 * Applies a partial update onto a base tenant config: strips explicit
 * `undefined` keys (see withoutUndefined in ./object) before spreading so a
 * caller that omits a field can never blank out an existing/default value,
 * recomputes derived theme/css/themeHash, and pins identity fields so a
 * stray tenantId/hostname in `partial` can't reassign them. This is the
 * only place base+partial tenant configs get merged — every call site
 * (fresh create, existing-tenant update here, and updateTenant below) goes
 * through it so the undefined-stripping can't be forgotten at a future one.
 *
 * `cms` is carved out of the generic shallow spread and merged separately
 * via mergeCmsConfig — a plain `...partial` would replace the entire `cms`
 * object (both slots AND menus) the moment a caller touches either one,
 * silently dropping every key it didn't mention.
 */
function mergeTenantConfig(
  base: TenantConfig,
  partial: TenantConfigUpdate | undefined,
  identity: Pick<TenantConfig, 'tenantId' | 'hostname'>,
): TenantConfig {
  const mergedTheme = mergeThemes(base.theme, partial?.theme);
  const { themeWithDerived, css, themeHash } = buildDerivedTheme(mergedTheme);
  const themeChanged = themeHash !== base.themeHash;

  return {
    ...base,
    ...(partial ? withoutUndefined(partial) : {}),
    ...identity,
    theme: themeWithDerived,
    css: themeChanged ? css : base.css,
    themeHash,
    cms: mergeCmsConfig(base.cms, partial?.cms),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates or updates a tenant configuration in KV storage.
 */
export async function createTenant(
  options: CreateTenantOptions,
): Promise<TenantConfig> {
  const { hostname, tenantId, config: partialConfig } = options;
  const storage = useStorage('kv');
  const cacheStorage = useStorage('cache');
  const finalTenantId = tenantId || hostname;
  const identity = { tenantId: finalTenantId, hostname };

  const rawExistingConfig = await storage.getItem<TenantConfig>(
    tenantConfigKey(finalTenantId),
  );
  const existingConfig = rawExistingConfig
    ? withTenantConfigDefaults(rawExistingConfig)
    : null;

  if (existingConfig) {
    // The request's hostname must already belong to this tenant — a
    // matching tenantId alone isn't proof the caller controls this
    // hostname, since tenantId is a predictable slug, not a secret. This
    // stops a request naming an unrelated hostname from silently
    // retargeting or claiming it for an existing tenant. Adding a new
    // hostname to a tenant is the `aliases` field's job, not this one.
    if (!collectAllHostnames(existingConfig).has(hostname)) {
      throw createAppError(
        ErrorCode.CONFLICT,
        `tenantId "${finalTenantId}" already exists for a different hostname`,
      );
    }
    if (!partialConfig) return existingConfig;

    const updatedConfig = mergeTenantConfig(
      existingConfig,
      partialConfig,
      identity,
    );
    await storage.setItem(tenantConfigKey(finalTenantId), updatedConfig);
    // Independent writes to unrelated storage — hostname mappings live in
    // `kv`, cache invalidation touches the `cache` namespace/in-memory
    // maps — neither depends on the other completing first.
    await Promise.all([
      writeHostnameMappings(storage, updatedConfig),
      invalidateTenantCaches(
        finalTenantId,
        collectAllHostnames(updatedConfig),
        cacheStorage,
      ),
    ]);
    return updatedConfig;
  }

  // theme/css/themeHash are placeholders here — mergeTenantConfig below is
  // the only place that actually derives them (mergeThemes(baseConfig.theme,
  // partialConfig?.theme) followed by buildDerivedTheme), so deriving them
  // again here would just repeat the same 32-color computation, CSS
  // generation, and hash for no reason.
  const baseConfig: TenantConfig = {
    ...identity,
    geinsSettings: defaultGeinsSettings(),
    mode: 'commerce',
    checkoutMode: 'hosted',
    timezone: 'UTC',
    theme: createDefaultTheme(finalTenantId),
    css: '',
    themeHash: '',
    branding: { name: finalTenantId, watermark: 'full' },
    features: {
      search: { enabled: true },
      cart: { enabled: true },
    },
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const finalConfig = mergeTenantConfig(baseConfig, partialConfig, identity);

  await storage.setItem(tenantConfigKey(finalTenantId), finalConfig);
  await Promise.all([
    writeHostnameMappings(storage, finalConfig),
    // Clears any negative-cache entry from a lookup that happened before
    // this hostname was onboarded, so it resolves immediately rather than
    // waiting out the 5-minute TTL.
    invalidateTenantCaches(
      finalTenantId,
      collectAllHostnames(finalConfig),
      cacheStorage,
    ),
  ]);
  return finalConfig;
}

/**
 * Updates an existing tenant configuration
 */
export async function updateTenant(
  hostname: string,
  updates: TenantConfigUpdate,
  event?: import('h3').H3Event,
): Promise<TenantConfig | null> {
  const storage = useStorage('kv');
  const existing = await resolveTenant(hostname, event);

  if (!existing) {
    return null;
  }

  const tid = existing.tenantId || hostname;
  const updatedConfig = mergeTenantConfig(existing, updates, {
    tenantId: tid,
    hostname: existing.hostname,
  });

  await storage.setItem(tenantConfigKey(tid), updatedConfig);
  await Promise.all([
    writeHostnameMappings(storage, updatedConfig),
    invalidateTenantCaches(
      tid,
      collectAllHostnames(updatedConfig),
      useStorage('cache'),
    ),
  ]);
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

    const hostnames = config
      ? collectAllHostnames(config)
      : new Set([hostname]);
    await Promise.all(
      [...hostnames].map((h) => storage.removeItem(tenantIdKey(h))),
    );

    await Promise.all([
      storage.removeItem(tenantConfigKey(tid)),
      invalidateTenantCaches(tid, hostnames, useStorage('cache')),
    ]);
    return true;
  } catch {
    return false;
  }
}
