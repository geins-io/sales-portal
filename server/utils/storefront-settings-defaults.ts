import { coerceToOklch } from './color-coercion';
import type { StoreSettings, FeatureConfig } from '../schemas/store-settings';

/**
 * Canonical storefront-settings defaults applied per-field when the merchant
 * API omits a key. Empty-string and `false` from the API are authoritative
 * and win over these defaults. Only `undefined` triggers fallback.
 *
 * Color values are pre-coerced to OKLCH at module load so downstream CSS
 * emission never sees raw hex. The source hex is kept in HEX_DEFAULTS below
 * for human review (admin shows hex, this file mirrors what an admin would
 * paste in).
 */

// Source hex defaults. Preserve exactly as written; they are the human-
// readable reference. Runtime values come from COLOR_DEFAULTS below.
const HEX_DEFAULTS = {
  buttonBackground: '#363636',
  buttonText: '#ffffff',
  buttonPurchaseBackground: '#363636',
  buttonPurchaseText: '#ffffff',
  siteBackground: '#FAFAFA',
  navBarBackground: '#FFFFFF',
  topBarBackground: '#363636',
  topBarText: '#ffffff',
  footerBackground: '#363636',
  footerText: '#ffffff',
} as const;

function coerceOrThrow(hex: string): string {
  const result = coerceToOklch(hex);
  if (!result) {
    throw new Error(
      `[storefront-settings-defaults] Failed to coerce default hex "${hex}" to OKLCH`,
    );
  }
  return result.value;
}

const COLOR_DEFAULTS: Record<keyof typeof HEX_DEFAULTS, string> =
  Object.fromEntries(
    Object.entries(HEX_DEFAULTS).map(([k, v]) => [k, coerceOrThrow(v)]),
  ) as Record<keyof typeof HEX_DEFAULTS, string>;

/**
 * Canonical defaults. Shape mirrors `StoreSettings` partially; identity
 * fields (tenantId/hostname/geinsSettings/timestamps/isActive) are never
 * defaulted here because they come from the API or the auto-provision path.
 *
 * Feature-flag default policy (read this before adding a new feature):
 *
 *   - Flags Studio exposes a toggle for default to `enabled: false`.
 *     Today this is `priceVisibility`, `orderPlacement`, `stockStatus`.
 *     The merchant opts in via Studio; the API then writes the explicit
 *     `true`/`false`. When the key is absent we treat the merchant as
 *     not yet opted in and keep the feature off.
 *
 *   - All other flags default to `enabled: true` because Studio has no
 *     toggle for them and they are required for storefront baseline
 *     behaviour (cart, checkout, lists, etc.).
 */
export const STOREFRONT_SETTINGS_DEFAULTS = {
  mode: 'commerce' as const,
  features: {
    analytics: { enabled: true } as FeatureConfig,
    applyForAccount: { enabled: true } as FeatureConfig,
    cart: { enabled: true } as FeatureConfig,
    checkout: { enabled: true } as FeatureConfig,
    lists: { enabled: true } as FeatureConfig,
    newsletterSignup: { enabled: true } as FeatureConfig,
    orderHistory: { enabled: true } as FeatureConfig,
    orderPlacement: {
      enabled: false,
      access: 'authenticated',
    } as FeatureConfig,
    priceVisibility: {
      enabled: false,
      access: 'authenticated',
    } as FeatureConfig,
    quotes: { enabled: true } as FeatureConfig,
    registration: { enabled: true } as FeatureConfig,
    reorder: { enabled: true } as FeatureConfig,
    stockStatus: {
      enabled: false,
      access: 'authenticated',
    } as FeatureConfig,
    wishlist: { enabled: true } as FeatureConfig,
  },
  theme: {
    radius: '0',
    typography: {
      fontFamily: 'Geist',
      headingFontFamily: 'Hanuman',
    },
    colors: { ...COLOR_DEFAULTS },
  },
  seo: {
    defaultTitle: '',
    titleTemplate: '',
    defaultDescription: '',
    defaultKeywords: [] as string[],
    robots: 'index, follow',
    googleAnalyticsId: '',
    googleTagManagerId: '',
    verification: '',
  },
  contact: {
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      postalCode: '',
      country: '',
    },
  },
  branding: {
    logoUrl: '',
    faviconUrl: '',
  },
} as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Recursive deep merge with three rules:
 *   - plain objects recurse
 *   - arrays from override replace base entirely (no concat)
 *   - `undefined` in override falls back to base; everything else wins
 *     (including `""`, `false`, `null`).
 */
function mergeDefaults(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    for (const key of Object.keys(override)) {
      const o = override[key];
      if (o === undefined) continue;
      result[key] = mergeDefaults(base[key], o);
    }
    return result;
  }
  return override;
}

/**
 * Merges a partial StoreSettings shape (from the merchant API) onto the
 * canonical defaults. Per-field fallback: missing keys inherit, present
 * keys win including explicit "" / false / null.
 */
export function mergeStorefrontSettings(
  api: Partial<StoreSettings>,
): StoreSettings {
  return mergeDefaults(STOREFRONT_SETTINGS_DEFAULTS, api) as StoreSettings;
}
