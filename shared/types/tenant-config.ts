import type { CmsSlotConfig, CmsSlotKey } from './cms-slots';
import type { CmsMenuConfig, CmsMenuKey } from '../constants/cms';

export type {
  StoreSettings,
  ThemeColors,
  ThemeConfig,
  ThemeTypography,
  GeinsSettings,
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
  tenantId: string;
  hostname: string;
  aliases?: string[];

  // SDK config (server-only, transformed from platform shape)
  geinsSettings: {
    apiKey: string;
    accountName: string;
    channel: string;
    tld: string;
    locale: string;
    market: string;
    environment: 'production' | 'staging';
    availableLocales: string[];
    availableMarkets: string[];
    // Overrides the accountName-derived image CDN host (see getPublicConfig
    // in server/services/tenant-config.ts) for tenants whose image subdomain
    // doesn't match their Geins account name.
    imageBaseUrl?: string;
  };

  // Portal mode
  mode: 'commerce' | 'catalog';

  // Checkout mode
  checkoutMode: 'custom' | 'hosted';

  // IANA timezone identifier (e.g. 'Europe/Stockholm'), never a raw UTC
  // offset — offsets don't survive DST. Anchors record-type timestamps
  // (order placed, invoice date) to the tenant's own operating timezone
  // rather than the server's OS timezone or each viewer's browser.
  // Optional on the stored shape: configs written before this field existed
  // have no timezone, and the merchant admin has no way to know it was added.
  // withTenantConfigDefaults() fills 'UTC' on read — deliberately not a
  // tenant-specific guess; see docs/lessons-learned.md for why defaults here
  // must stay generic. PublicTenantConfig below requires it, because the
  // builder always resolves one.
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

  // Product-parameter → media-kind mapping — same pattern as `cms` above.
  // A merchant's PIM names its video/document parameters freely (see
  // shared/constants/product-media.ts); this maps that tenant's actual
  // parameter names onto the fixed 'video'/'document' kinds the storefront
  // knows how to render. Missing keys inherit PRODUCT_MEDIA_PARAMETER_DEFAULTS
  // (merged in server/utils/tenant.ts), so an unconfigured tenant behaves
  // exactly as if this field didn't exist.
  productMediaParameters?: Record<string, 'video' | 'document'>;

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

  // Metadata
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shape of `cms` in a partial tenant update (admin create/update input),
 * as opposed to `TenantConfig['cms']` itself (the stored/resolved shape,
 * which never contains `null`). A slot or menu key set to `null` here
 * means "remove this key" rather than "set it to null" — see
 * mergeCmsConfig in server/utils/tenant-crud.ts, which is the only place
 * that interprets it. Omitting a key (the normal `Partial` case) leaves
 * it untouched, same as every other tenant config field.
 */
export interface CmsConfigUpdate {
  slots?: Partial<Record<CmsSlotKey, CmsSlotConfig | null>>;
  menus?: Partial<Record<CmsMenuKey, CmsMenuConfig | null>>;
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
  checkoutMode: 'custom' | 'hosted';
  timezone: string;
  theme: TenantConfig['theme'];
  branding: TenantConfig['branding'];
  layout?: TenantConfig['layout'];
  features: TenantConfig['features'];
  cms?: TenantConfig['cms'];
  productMediaParameters?: TenantConfig['productMediaParameters'];
  seo?: TenantConfig['seo'];
  contact?: TenantConfig['contact'];
  css: string;
  isActive: boolean;

  // Derived from geinsSettings before stripping
  locale?: string;
  market?: string;
  availableLocales: string[];
  availableMarkets: string[];
  imageBaseUrl: string;
}

/**
 * Minimal tenant context available in request handlers.
 */
export interface TenantContext {
  id: string;
  hostname: string;
}
