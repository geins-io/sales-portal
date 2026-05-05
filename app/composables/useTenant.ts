import type {
  FeatureAccess,
  PublicTenantConfig,
} from '#shared/types/tenant-config';

type FeatureEntry = { enabled: boolean; access?: FeatureAccess };
type FeatureMap = Record<string, FeatureEntry>;

/**
 * The runtime tenant payload may carry an `overrides.features` map even
 * though the public type doesn't formally surface it. Read it
 * structurally so this composable can resolve overrides without forcing
 * a wider schema change. If the property is absent (today's prod path),
 * resolution falls back to the base `features` map.
 */
function readOverrideFeatures(
  tenant: PublicTenantConfig | null | undefined,
): FeatureMap | undefined {
  const carrier = tenant as
    | (PublicTenantConfig & {
        overrides?: { features?: FeatureMap | null } | null;
      })
    | null
    | undefined;
  return carrier?.overrides?.features ?? undefined;
}

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
  /**
   * Effective features = base features with override entries replacing
   * (not deep-merging) the matching base entry per feature name. An
   * override that sets `{ enabled: false }` legitimately wins over a
   * base `{ enabled: true }`. `??` (not `||`) on the per-feature lookup
   * keeps that semantics.
   */
  const features = computed<FeatureMap | undefined>(() => {
    const base = tenant.value?.features;
    const override = readOverrideFeatures(tenant.value);
    if (!base && !override) return undefined;
    const merged: FeatureMap = { ...(base ?? {}) };
    if (override) {
      for (const [name, entry] of Object.entries(override)) {
        merged[name] = entry;
      }
    }
    return merged;
  });
  const contact = computed(() => tenant.value?.contact ?? null);
  const mode = computed(() => tenant.value?.mode ?? 'commerce');
  const checkoutMode = computed(() => tenant.value?.checkoutMode ?? 'custom');
  const watermark = computed(() => tenant.value?.branding?.watermark ?? 'full');

  /**
   * Check if a feature is enabled.
   * Features are Record<string, { enabled, access? }>. Override
   * entries (when present) replace base entries per feature name. The
   * `??` ensures an override `{ enabled: false }` wins over a base
   * `{ enabled: true }`.
   */
  const hasFeature = (featureName: string): boolean => {
    const overrideEntry = readOverrideFeatures(tenant.value)?.[featureName];
    const baseEntry = tenant.value?.features?.[featureName];
    const entry = overrideEntry ?? baseEntry;
    if (!entry) return false;
    return entry.enabled;
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

  /** Available market codes for this tenant (e.g. ['se', 'no', 'dk']). */
  const availableMarkets = computed(() => {
    return tenant.value?.availableMarkets ?? [];
  });

  /** Default market code (e.g. 'se'). */
  const market = computed(() => tenant.value?.market ?? '');

  const imageBaseUrl = computed(() => tenant.value?.imageBaseUrl ?? '');

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
    checkoutMode,
    watermark,
    availableLocales,
    availableMarkets,
    market,
    imageBaseUrl,
    features,
    hasFeature,
    contact,
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
