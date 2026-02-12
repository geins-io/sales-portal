import type { PublicTenantConfig } from '#shared/types/tenant-config';

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
 */
export function useTenant() {
  const asyncData = useFetch<PublicTenantConfig>('/api/config', {
    dedupe: 'defer',
    $fetch: useNuxtApp().$api as typeof $fetch,
  });
  const { data: tenant, pending: isLoading, error, refresh } = asyncData;

  const tenantId = computed(() => tenant.value?.tenantId ?? '');
  const hostname = computed(() => tenant.value?.hostname ?? '');
  const theme = computed(() => tenant.value?.theme);
  const branding = computed(() => tenant.value?.branding);
  const features = computed(() => tenant.value?.features);
  const mode = computed(() => tenant.value?.mode ?? 'commerce');
  const watermark = computed(() => tenant.value?.branding?.watermark ?? 'full');

  /**
   * Check if a feature is enabled.
   * Features are now Record<string, { enabled, access? }>.
   */
  const hasFeature = (featureName: string): boolean => {
    const feature = tenant.value?.features?.[featureName];
    if (!feature) return false;
    return feature.enabled;
  };

  const logoUrl = computed(() => {
    return tenant.value?.branding?.logoUrl ?? '/logo.svg';
  });

  const logoDarkUrl = computed(() => {
    return tenant.value?.branding?.logoDarkUrl ?? null;
  });

  const logoSymbolUrl = computed(() => {
    return tenant.value?.branding?.logoSymbolUrl ?? null;
  });

  const faviconUrl = computed(() => {
    return tenant.value?.branding?.faviconUrl ?? '/favicon.ico';
  });

  const ogImageUrl = computed(() => {
    return tenant.value?.branding?.ogImageUrl ?? null;
  });

  const brandName = computed(() => {
    return tenant.value?.branding?.name ?? tenant.value?.tenantId ?? 'Store';
  });

  /**
   * Available locale codes for this tenant.
   * Maps full Geins locales (e.g. 'sv-SE') to short i18n codes ('sv').
   */
  const availableLocales = computed(() => {
    const raw = tenant.value;
    if (!raw) return [];
    const locales = raw.availableLocales;
    if (!Array.isArray(locales)) return [];
    return locales.map((l: string) => l.split('-')[0]);
  });

  return {
    tenant,
    tenantId,
    hostname,
    isLoading,
    error,
    refresh,
    theme,
    branding,
    logoUrl,
    logoDarkUrl,
    logoSymbolUrl,
    faviconUrl,
    ogImageUrl,
    brandName,
    mode,
    watermark,
    availableLocales,
    features,
    hasFeature,
    suspense: () => asyncData,
  };
}

/**
 * Composable for accessing tenant theme colors.
 */
export function useTenantTheme() {
  const { tenant } = useTenant();

  const colors = computed(() => tenant.value?.theme?.colors);
  const typography = computed(() => tenant.value?.theme?.typography);
  const radius = computed(() => tenant.value?.theme?.radius);

  const getColor = (colorName: string, fallback: string = ''): string => {
    const colorMap = tenant.value?.theme?.colors;
    if (!colorMap) return fallback;
    const value = colorMap[colorName];
    return (typeof value === 'string' ? value : null) ?? fallback;
  };

  const primaryColor = computed(
    () => (tenant.value?.theme?.colors?.primary as string) ?? '#000000',
  );

  const secondaryColor = computed(
    () => (tenant.value?.theme?.colors?.secondary as string) ?? '#ffffff',
  );

  const backgroundColor = computed(
    () => (tenant.value?.theme?.colors?.background as string) ?? 'oklch(1 0 0)',
  );

  const foregroundColor = computed(
    () =>
      (tenant.value?.theme?.colors?.foreground as string) ?? 'oklch(0.145 0 0)',
  );

  return {
    colors,
    typography,
    radius,
    getColor,
    primaryColor,
    secondaryColor,
    backgroundColor,
    foregroundColor,
  };
}
