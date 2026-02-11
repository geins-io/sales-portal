export type {
  StoreSettings,
  ThemeColors,
  ThemeConfig,
  ThemeTypography,
  GeinsSettings,
  BrandingConfig,
  FeatureAccess,
  FeatureConfig,
  SeoConfig,
  ContactConfig,
  OverrideConfig,
} from '../../server/schemas/store-settings';

/**
 * Full tenant configuration — StoreSettings from API + computed fields.
 * Only available server-side; client receives PublicTenantConfig.
 */
export interface TenantConfig {
  // Identification
  tenantId: string;
  hostname: string;
  aliases?: string[];

  // SDK config (server-only)
  geinsSettings: {
    apiKey: string;
    accountName: string;
    channel: string;
    tld: string;
    locale: string;
    market: string;
    environment: 'production' | 'staging';
  };

  // Portal mode
  mode: 'commerce' | 'catalog';

  // Theme
  theme: {
    name: string;
    displayName?: string | null;
    colors: Record<string, string | null | undefined>;
    radius?: string | null;
    typography?: {
      fontFamily: string;
      headingFontFamily?: string | null;
      monoFontFamily?: string | null;
    } | null;
  };

  // Branding
  branding: {
    name: string;
    watermark: 'full' | 'minimal' | 'none';
    logoUrl?: string | null;
    logoDarkUrl?: string | null;
    logoSymbolUrl?: string | null;
    faviconUrl?: string | null;
    ogImageUrl?: string | null;
  };

  // Features — keyed by feature name
  features: Record<string, { enabled: boolean; access?: unknown }>;

  // Optional sections
  seo?: {
    defaultTitle?: string | null;
    titleTemplate?: string | null;
    defaultDescription?: string | null;
    defaultKeywords?: string[] | null;
    robots?: string | null;
    googleAnalyticsId?: string | null;
    googleTagManagerId?: string | null;
    verification?: { google?: string | null; bing?: string | null } | null;
  } | null;

  contact?: {
    email?: string | null;
    phone?: string | null;
    address?: {
      street?: string | null;
      city?: string | null;
      postalCode?: string | null;
      country?: string | null;
    } | null;
    social?: {
      facebook?: string | null;
      instagram?: string | null;
      twitter?: string | null;
      linkedin?: string | null;
      youtube?: string | null;
    } | null;
  } | null;

  // Overrides
  overrides?: {
    css?: Record<string, string> | null;
    features?: Record<string, { enabled: boolean; access?: unknown }> | null;
  } | null;

  // Computed fields (added by server during fetch)
  css: string;
  themeHash?: string;

  // Metadata
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public tenant config sent to the client via /api/config.
 * Strips geinsSettings, overrides, themeHash. Adds locale fields.
 */
export interface PublicTenantConfig {
  tenantId: string;
  hostname: string;
  aliases?: string[];
  mode: 'commerce' | 'catalog';
  theme: TenantConfig['theme'];
  branding: TenantConfig['branding'];
  features: TenantConfig['features'];
  seo?: TenantConfig['seo'];
  contact?: TenantConfig['contact'];
  css: string;
  isActive: boolean;

  // Derived from geinsSettings before stripping
  locale?: string;
  availableLocales: string[];
}

/**
 * Minimal tenant context available in request handlers.
 */
export interface TenantContext {
  id: string;
  hostname: string;
}
