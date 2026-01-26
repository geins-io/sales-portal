import type { TenantConfig } from '#shared/types/tenant-config';

/**
 * Composable for accessing the current tenant configuration.
 *
 * This composable provides reactive access to the tenant config
 * which is automatically loaded based on the request hostname.
 *
 * @example
 * ```vue
 * <script setup>
 * const { tenant, isLoading, error } = useTenant()
 *
 * // Access tenant data
 * const brandName = computed(() => tenant.value?.branding?.name ?? tenant.value?.tenantId)
 * </script>
 * ```
 */
export function useTenant() {
  const asyncData = useApi<TenantConfig>('/api/config');
  const { data, pending, error, refresh } = asyncData;

  /**
   * The tenant configuration object
   */
  const tenant = computed(() => data.value);

  /**
   * Whether the tenant config is currently loading
   */
  const isLoading = computed(() => pending.value);

  /**
   * The tenant ID
   */
  const tenantId = computed(() => data.value?.tenantId ?? '');

  /**
   * The hostname for this tenant
   */
  const hostname = computed(() => data.value?.hostname ?? '');

  /**
   * The theme configuration
   */
  const theme = computed(() => data.value?.theme);

  /**
   * The branding configuration
   */
  const branding = computed(() => data.value?.branding);

  /**
   * The feature flags
   */
  const features = computed(() => data.value?.features);

  /**
   * Check if a feature is enabled
   */
  const hasFeature = (
    featureName: keyof NonNullable<TenantConfig['features']>,
  ): boolean => {
    return data.value?.features?.[featureName] ?? false;
  };

  /**
   * Get the logo URL (with fallback to dark version if needed)
   */
  const logoUrl = computed(() => {
    return data.value?.branding?.logoUrl ?? '/logo.svg';
  });

  /**
   * Get the brand name
   */
  const brandName = computed(() => {
    return data.value?.branding?.name ?? data.value?.tenantId ?? 'Store';
  });

  return {
    // Core data
    tenant,
    tenantId,
    hostname,
    isLoading,
    error,
    refresh,
    // Theme
    theme,
    // Branding
    branding,
    logoUrl,
    brandName,
    // Features
    features,
    hasFeature,
    /**
     * Awaitable promise for SSR - ensures data is loaded before accessing values.
     * Use in plugins/middleware: `const { suspense, tenant } = useTenant(); await suspense();`
     */
    suspense: () => asyncData,
  };
}

/**
 * Composable for accessing tenant theme colors.
 *
 * Provides easy access to theme colors with proper defaults.
 *
 * @example
 * ```vue
 * <script setup>
 * const { primaryColor, backgroundColor } = useTenantTheme()
 * </script>
 * ```
 */
export function useTenantTheme() {
  const { theme } = useTenant();

  const colors = computed(() => theme.value?.colors);
  const typography = computed(() => theme.value?.typography);
  const borderRadius = computed(() => theme.value?.borderRadius);

  /**
   * Get a color value with fallback
   */
  const getColor = (
    colorName: keyof NonNullable<TenantConfig['theme']['colors']>,
    fallback: string = '',
  ): string => {
    return colors.value?.[colorName] ?? fallback;
  };

  /**
   * Primary brand color
   */
  const primaryColor = computed(() => colors.value?.primary ?? '#000000');

  /**
   * Secondary brand color
   */
  const secondaryColor = computed(() => colors.value?.secondary ?? '#ffffff');

  /**
   * Background color
   */
  const backgroundColor = computed(
    () => colors.value?.background ?? 'oklch(1 0 0)',
  );

  /**
   * Foreground/text color
   */
  const foregroundColor = computed(
    () => colors.value?.foreground ?? 'oklch(0.145 0 0)',
  );

  return {
    colors,
    typography,
    borderRadius,
    getColor,
    primaryColor,
    secondaryColor,
    backgroundColor,
    foregroundColor,
  };
}
