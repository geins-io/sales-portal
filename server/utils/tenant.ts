import type { TenantConfig } from '#shared/types/tenant-config';

// generate a random color
function generateRandomColor(): string {
  return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
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
  const existingId = await storage.getItem<string>(`tenant:id:${hostname}`);

  if (!existingId) {
    // Map hostname to tenant ID
    await storage.setItem(`tenant:id:${hostname}`, finalTenantId);
  }

  // Check if tenant config exists
  const existingConfig = await storage.getItem<TenantConfig>(
    `tenant:config:${finalTenantId}`,
  );

  if (!existingConfig) {
    // Create new tenant config
    await storage.setItem(`tenant:config:${finalTenantId}`, finalConfig);
    return finalConfig;
  }

  // If config exists but we want to update it, merge and save
  if (partialConfig) {
    const updatedConfig: TenantConfig = {
      theme: {
        ...existingConfig.theme,
        ...partialConfig.theme,
        colors: {
          ...existingConfig.theme.colors,
          ...(partialConfig.theme?.colors || {}),
        },
      },
    };
    await storage.setItem(`tenant:config:${finalTenantId}`, updatedConfig);
    return updatedConfig;
  }

  return existingConfig;
}
