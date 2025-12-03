import type { TenantConfig } from '#shared/types/tenant-config';

// TESTING PURPOSES ONLY
// generate a random color
function generateRandomColor(): string {
  return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
}

export function tenantIdKey(hostname: string): string {
  return `tenant:id:${hostname}`;
}
export function tenantConfigKey(tenantId: string): string {
  return `tenant:config:${tenantId}`;
}

// TESTING PURPOSES ONLY
export function tenantCustomCss(tenantId: string): string {
  return `
   [data-theme='${tenantId}'] {
    --primary: #00ec56;
    --primary-foreground: #000;
    }
  `;
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

  // Create default config
  const defaultConfig: TenantConfig = {
    tenantId: finalTenantId,
    hostname: hostname,
    css: tenantCustomCss(finalTenantId),
    theme: {
      name: finalTenantId,
      colors: {
        primary: '#000000',
        secondary: generateRandomColor(),
      },
    },
  };

  // Merge with provided config
  const finalConfig: TenantConfig = {
    tenantId: finalTenantId,
    hostname: hostname,
    css: tenantCustomCss(finalTenantId),
    theme: {
      ...defaultConfig.theme,
      ...(partialConfig?.theme || {}),
      colors: {
        ...defaultConfig.theme.colors,
        ...(partialConfig?.theme?.colors || {}),
      },
    },
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
    const updatedConfig: TenantConfig = {
      tenantId: finalTenantId,
      hostname: hostname,
      css: '',
      theme: {
        ...existingConfig.theme,
        ...partialConfig.theme,
        colors: {
          ...existingConfig.theme.colors,
          ...(partialConfig.theme?.colors || {}),
        },
      },
    };
    await storage.setItem(tenantConfigKey(finalTenantId), updatedConfig);
    return updatedConfig;
  }

  // If config exists but we don't want to update it, return the existing config
  return existingConfig;
}
