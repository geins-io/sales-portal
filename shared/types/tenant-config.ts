import type { CmsSlotConfig, CmsSlotKey } from './cms-slots';
import type { CmsMenuConfig, CmsMenuKey } from '../constants/cms';

export type {
  StoreSettings,
  ThemeColors,
  ThemeConfig,
  ThemeTypography,
  ChannelSettings,
  BrandingConfig,
  FeatureConfig,
  SeoConfig,
  ContactConfig,
  OverrideConfig,
} from '../../server/schemas/store-settings';

/**
 * Feature access control — who can access a feature.
 * Standalone type so shared/ utilities don't depend on server/schemas/.
 *
 * Only rules the app can evaluate. The wire shape (`FeatureAccessInput`) is
 * wider; `normalizeFeatureAccess` in server/utils/tenant.ts retires the rest.
 * See ADR-007 for which rules were dropped and why.
 */
export type FeatureAccess = 'all' | 'authenticated';

/**
 * Full tenant configuration — StoreSettings from API + computed fields.
 * Only available server-side; client receives PublicTenantConfig.
 */
export interface TenantConfig {
  // Identification
  accountName: string;
  hostname: string;
  aliases?: string[];

  // Geins credentials and channel (server-only)
  apiKey: string;
  channelSettings: {
    /** `"1|se"`: channel and tld. */
    channelId: string;
    defaultLocale: string;
    defaultMarket: string;
    locales: string[];
    markets: string[];
  };

  // Portal mode
  mode: 'commerce' | 'catalog';

  // Checkout mode
  checkoutMode: 'custom' | 'hosted';

  /**
   * IANA timezone the tenant operates in (e.g. 'Europe/Stockholm'), used to
   * anchor record-type timestamps — order placed, invoice date — to one zone
   * rather than the server's or each viewer's.
   *
   * Optional, and with no default on purpose. A tenant configured before this
   * field existed has no value for it and no way to set one, so substituting
   * any zone would silently re-date its existing orders. Unset means the
   * formatter omits `timeZone` entirely, which is the behaviour every tenant
   * has today; a tenant that sets it gets a stable zone from that point on.
   */
  timezone?: string;

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

  // Layout variants — tenant-tunable presentation knobs.
  // Missing keys fall back to component defaults.
  layout?: {
    headerNavVariant?: 'grey' | 'white' | null;
  } | null;

  // Features — keyed by feature name
  features: Record<string, { enabled: boolean; access?: FeatureAccess }>;

  // CMS slot + menu registry — see docs/patterns/cms-config.md for the
  // design. Tenant config wins per key over DEFAULT_CMS_CONFIG in
  // server/utils/tenant.ts; slots and menus neither layer defines
  // resolve to null and consumers fall back gracefully.
  cms?: {
    slots?: Partial<Record<CmsSlotKey, CmsSlotConfig>>;
    menus?: Partial<Record<CmsMenuKey, CmsMenuConfig>>;
  };

  // Optional sections
  seo?: {
    defaultTitle?: string | null;
    titleTemplate?: string | null;
    defaultDescription?: string | null;
    defaultKeywords?: string[] | null;
    robots?: string | null;
    googleAnalyticsId?: string | null;
    googleTagManagerId?: string | null;
    verification?: string | null;
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
    features?: Record<
      string,
      { enabled: boolean; access?: FeatureAccess }
    > | null;
  } | null;

  // Computed fields (added by server during fetch)
  css: string;
  themeHash?: string;

  /** The channel's asset library, `https://{cdnHost}/{account}`; null when it has none. */
  assetPath: string | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Public tenant config sent to the client via /api/config.
 * Strips apiKey, channelSettings, overrides, themeHash. Adds locale fields.
 * Field names here are the public contract and do not follow the internal
 * ones: `tenantId` is the account name.
 */
export interface PublicTenantConfig {
  tenantId: string;
  hostname: string;
  aliases?: string[];
  mode: 'commerce' | 'catalog';
  checkoutMode: 'custom' | 'hosted';
  timezone?: string;
  theme: TenantConfig['theme'];
  branding: TenantConfig['branding'];
  layout?: TenantConfig['layout'];
  features: TenantConfig['features'];
  cms?: TenantConfig['cms'];
  seo?: TenantConfig['seo'];
  contact?: TenantConfig['contact'];
  css: string;

  // Derived from channelSettings before stripping
  locale?: string;
  market?: string;
  availableLocales: string[];
  availableMarkets: string[];
  imageBaseUrl: string;
  /** The channel's asset library, `https://{cdnHost}/{account}`; unset when it has none. */
  assetBaseUrl?: string;
}

/**
 * Minimal tenant context available in request handlers.
 */
export interface TenantContext {
  id: string;
  hostname: string;
}
