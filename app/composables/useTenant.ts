import type { TenantConfig } from '#shared/types/tenant-config';

/**
 * Composable for accessing the current tenant configuration.
 *
 * This composable provides reactive access to the tenant config
 * which is automatically loaded based on the request hostname.
 *
 * Uses Nuxt 4's built-in `useFetch` with `dedupe: 'defer'` for:
 * - Automatic request deduplication
 * - SSR payload transfer
 * - Built-in caching
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
  // Use useFetch directly with dedupe: 'defer' for built-in deduplication
  // This prevents multiple simultaneous requests and leverages Nuxt's SSR optimization
  const asyncData = useFetch<TenantConfig>('/api/config', {
    dedupe: 'defer',
    $fetch: useNuxtApp().$api as typeof $fetch,
  });
  const { data: tenant, pending: isLoading, error, refresh } = asyncData;

  /**
   * The tenant ID
   */
  const tenantId = computed(() => tenant.value?.tenantId ?? '');

  /**
   * The hostname for this tenant
   */
  const hostname = computed(() => tenant.value?.hostname ?? '');

  /**
   * The theme configuration
   */
  const theme = computed(() => tenant.value?.theme);

  /**
   * The branding configuration
   */
  const branding = computed(() => tenant.value?.branding);

  /**
   * The feature flags
   */
  const features = computed(() => tenant.value?.features);

  /**
   * Check if a feature is enabled
   */
  const hasFeature = (
    featureName: keyof NonNullable<TenantConfig['features']>,
  ): boolean => {
    return tenant.value?.features?.[featureName] ?? false;
  };

  /**
   * Get the logo URL (with fallback to dark version if needed)
   */
  const logoUrl = computed(() => {
    return tenant.value?.branding?.logoUrl ?? '/logo.svg';
  });

  /**
   * Get the brand name
   */
  const brandName = computed(() => {
    return tenant.value?.branding?.name ?? tenant.value?.tenantId ?? 'Store';
  });

  /**
   * Available locale codes for this tenant.
   * Maps full Geins locales (e.g. 'sv-SE') to short i18n codes ('sv').
   * The `availableLocales` field is added by the config API but not on the TenantConfig type,
   * so we access it via a safe runtime check.
   */
  const availableLocales = computed(() => {
    const raw = tenant.value;
    if (!raw) return [];
    const locales = (raw as unknown as Record<string, unknown>)
      .availableLocales;
    if (!Array.isArray(locales)) return [];
    return (locales as string[]).map((l: string) => l.split('-')[0]);
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
    // Locale
    availableLocales,
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
  const { tenant } = useTenant();

  // Access theme properties directly to avoid computed chain overhead
  const colors = computed(() => tenant.value?.theme?.colors);
  const typography = computed(() => tenant.value?.theme?.typography);
  const borderRadius = computed(() => tenant.value?.theme?.borderRadius);

  /**
   * Get a color value with fallback
   */
  const getColor = (
    colorName: keyof NonNullable<TenantConfig['theme']['colors']>,
    fallback: string = '',
  ): string => {
    return tenant.value?.theme?.colors?.[colorName] ?? fallback;
  };

  /**
   * Primary brand color
   */
  const primaryColor = computed(
    () => tenant.value?.theme?.colors?.primary ?? '#000000',
  );

  /**
   * Secondary brand color
   */
  const secondaryColor = computed(
    () => tenant.value?.theme?.colors?.secondary ?? '#ffffff',
  );

  /**
   * Background color
   */
  const backgroundColor = computed(
    () => tenant.value?.theme?.colors?.background ?? 'oklch(1 0 0)',
  );

  /**
   * Foreground/text color
   */
  const foregroundColor = computed(
    () => tenant.value?.theme?.colors?.foreground ?? 'oklch(0.145 0 0)',
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
