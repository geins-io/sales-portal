/**
 * Geins SDK configuration for connecting to the Geins platform
 */
export interface GeinsSettings {
  /** API key for authentication */
  apiKey: string;
  /** Account name in Geins */
  accountName: string;
  /** Channel identifier (e.g., 'web', 'mobile') */
  channel: string;
  /** Top-level domain (e.g., 'se', 'com') */
  tld: string;
  /** Locale for content (e.g., 'sv-SE', 'en-US') */
  locale: string;
  /** Market identifier for pricing and availability */
  market: string;
  /** Optional environment override (production/staging) */
  environment?: 'production' | 'staging';
}

/**
 * Theme color palette configuration
 * Uses CSS color values (hex, rgb, oklch, hsl, etc.)
 */
export interface ThemeColors {
  /** Primary brand color */
  primary: string;
  /** Primary foreground (text on primary backgrounds) */
  primaryForeground?: string;
  /** Secondary brand color */
  secondary: string;
  /** Secondary foreground (text on secondary backgrounds) */
  secondaryForeground?: string;
  /** Background color */
  background?: string;
  /** Foreground/text color */
  foreground?: string;
  /** Muted background color */
  muted?: string;
  /** Muted foreground color */
  mutedForeground?: string;
  /** Accent color */
  accent?: string;
  /** Accent foreground */
  accentForeground?: string;
  /** Destructive/error color */
  destructive?: string;
  /** Border color */
  border?: string;
  /** Input border color */
  input?: string;
  /** Focus ring color */
  ring?: string;
  /** Card background */
  card?: string;
  /** Card foreground */
  cardForeground?: string;
  /** Popover background */
  popover?: string;
  /** Popover foreground */
  popoverForeground?: string;
}

/**
 * Typography configuration
 */
export interface ThemeTypography {
  /** Primary font family for body text */
  fontFamily?: string;
  /** Heading font family */
  headingFontFamily?: string;
  /** Base font size (e.g., '16px', '1rem') */
  baseFontSize?: string;
}

/**
 * Border radius configuration
 */
export interface ThemeBorderRadius {
  /** Base radius value (e.g., '0.5rem') */
  base?: string;
  /** Small radius */
  sm?: string;
  /** Medium radius */
  md?: string;
  /** Large radius */
  lg?: string;
  /** Extra large radius */
  xl?: string;
}

/**
 * Complete theme configuration
 */
export interface TenantTheme {
  /** Theme identifier */
  name: string;
  /** Display name for the theme */
  displayName?: string;
  /** Color palette */
  colors: ThemeColors;
  /** Typography settings */
  typography?: ThemeTypography;
  /** Border radius settings */
  borderRadius?: ThemeBorderRadius;
  /** Custom CSS properties */
  customProperties?: Record<string, string>;
}

/**
 * Branding configuration for the tenant
 */
export interface TenantBranding {
  /** Company/brand name */
  name: string;
  /** Logo URL (full color version) */
  logoUrl?: string;
  /** Logo URL for dark backgrounds */
  logoDarkUrl?: string;
  /** Logo symbol/icon URL */
  logoSymbolUrl?: string;
  /** Favicon URL */
  faviconUrl?: string;
  /** Open Graph image URL */
  ogImageUrl?: string;
}

/**
 * Feature flags for tenant-specific functionality
 */
export interface TenantFeatures {
  /** Enable search functionality */
  search?: boolean;
  /** Enable user authentication */
  authentication?: boolean;
  /** Enable shopping cart */
  cart?: boolean;
  /** Enable wishlist */
  wishlist?: boolean;
  /** Enable product comparisons */
  productComparison?: boolean;
  /** Enable multi-language support */
  multiLanguage?: boolean;
  /** Enable newsletter signup */
  newsletter?: boolean;
}

/**
 * SEO and metadata configuration
 */
export interface TenantSeo {
  /** Default page title */
  defaultTitle?: string;
  /** Title template (use %s for page title) */
  titleTemplate?: string;
  /** Default meta description */
  defaultDescription?: string;
  /** Default keywords */
  defaultKeywords?: string[];
  /** Google Analytics ID */
  googleAnalyticsId?: string;
  /** Google Tag Manager ID */
  googleTagManagerId?: string;
}

/**
 * Contact information for the tenant
 */
export interface TenantContact {
  /** Support email */
  email?: string;
  /** Support phone number */
  phone?: string;
  /** Physical address */
  address?: string;
  /** Social media links */
  social?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
}

/**
 * Complete tenant configuration
 */
export interface TenantConfig {
  /** Unique tenant identifier */
  tenantId: string;
  /** Primary hostname for the tenant */
  hostname: string;
  /** Additional hostnames that map to this tenant */
  aliases?: string[];
  /** Geins SDK configuration */
  geinsSettings?: GeinsSettings;
  /** Theme configuration */
  theme: TenantTheme;
  /** Branding assets */
  branding?: TenantBranding;
  /** Feature flags */
  features?: TenantFeatures;
  /** SEO configuration */
  seo?: TenantSeo;
  /** Contact information */
  contact?: TenantContact;
  /** Custom CSS to inject */
  css: string;
  /** Whether the tenant is active */
  isActive?: boolean;
  /** Tenant creation date */
  createdAt?: string;
  /** Last update date */
  updatedAt?: string;
}

/**
 * Minimal tenant context available in request handlers
 */
export interface TenantContext {
  /** Tenant ID */
  id: string;
  /** Request hostname */
  hostname: string;
}

/**
 * Type alias for backward compatibility
 */
export type TenantConfigType = TenantConfig;
