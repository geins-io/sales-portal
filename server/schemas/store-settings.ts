import { z } from 'zod';

import { coerceToOklch } from '../utils/color-coercion';

// Accepts any CSS color string the merchant admin can produce
// (hex/rgb/hsl/named/oklch) and normalises to OKLCH. Alpha is preserved
// verbatim: opaque values emit `oklch(L C H)`, translucent values emit
// `oklch(L C H / A)`. The admin's saved value is the truth and downstream
// CSS variable injection forwards the OKLCH string as-is.
// Unparseable input fails with a Zod issue so the resilient parser can
// strip just the offending leaf rather than blanking the whole tenant.
const CoercedColorSchema = z.string().transform((raw, ctx) => {
  const result = coerceToOklch(raw);
  if (!result) {
    // Truncate so attacker-controlled large strings can't be echoed back
    // verbatim into error responses or logs through Zod's issue chain.
    const safe = raw.length > 40 ? `${raw.slice(0, 40)}...` : raw;
    ctx.addIssue({
      code: 'custom',
      message: `invalid color: ${safe}`,
    });
    return z.NEVER;
  }
  return result.value;
});

export const ThemeColorsSchema = z.object({
  primary: CoercedColorSchema,
  primaryForeground: CoercedColorSchema,
  secondary: CoercedColorSchema,
  secondaryForeground: CoercedColorSchema,
  background: CoercedColorSchema,
  foreground: CoercedColorSchema,

  // Optional palette: null from API = derive server-side.
  card: CoercedColorSchema.nullable().optional(),
  cardForeground: CoercedColorSchema.nullable().optional(),
  popover: CoercedColorSchema.nullable().optional(),
  popoverForeground: CoercedColorSchema.nullable().optional(),
  muted: CoercedColorSchema.nullable().optional(),
  mutedForeground: CoercedColorSchema.nullable().optional(),
  accent: CoercedColorSchema.nullable().optional(),
  accentForeground: CoercedColorSchema.nullable().optional(),
  destructive: CoercedColorSchema.nullable().optional(),
  destructiveForeground: CoercedColorSchema.nullable().optional(),
  border: CoercedColorSchema.nullable().optional(),
  input: CoercedColorSchema.nullable().optional(),
  ring: CoercedColorSchema.nullable().optional(),
  chart1: CoercedColorSchema.nullable().optional(),
  chart2: CoercedColorSchema.nullable().optional(),
  chart3: CoercedColorSchema.nullable().optional(),
  chart4: CoercedColorSchema.nullable().optional(),
  chart5: CoercedColorSchema.nullable().optional(),
  sidebar: CoercedColorSchema.nullable().optional(),
  sidebarForeground: CoercedColorSchema.nullable().optional(),
  sidebarPrimary: CoercedColorSchema.nullable().optional(),
  sidebarPrimaryForeground: CoercedColorSchema.nullable().optional(),
  sidebarAccent: CoercedColorSchema.nullable().optional(),
  sidebarAccentForeground: CoercedColorSchema.nullable().optional(),
  sidebarBorder: CoercedColorSchema.nullable().optional(),
  sidebarRing: CoercedColorSchema.nullable().optional(),

  // Surface keys: the tenant-css emitter resolves missing values to a
  // fallback CSS variable so components can blindly reference bg-<surface>.
  topBarBackground: CoercedColorSchema.nullable().optional(),
  footerBackground: CoercedColorSchema.nullable().optional(),
  navBarBackground: CoercedColorSchema.nullable().optional(),
  siteBackground: CoercedColorSchema.nullable().optional(),
  buttonBackground: CoercedColorSchema.nullable().optional(),
  buttonPurchaseBackground: CoercedColorSchema.nullable().optional(),
  topBarText: CoercedColorSchema.nullable().optional(),
  footerText: CoercedColorSchema.nullable().optional(),
});

export const ThemeTypographySchema = z.object({
  fontFamily: z.string(),
  headingFontFamily: z.string().nullable().optional(),
  monoFontFamily: z.string().nullable().optional(),
});

export const ThemeConfigSchema = z.object({
  // Cosmetic CSS selector label. Synthesized from tenantId in
  // buildTenantConfig when the API omits it — the merchant API has
  // started returning themes without this field and we don't want
  // to hard-fail tenant resolution over a missing label.
  name: z.string().optional(),
  displayName: z.string().nullable().optional(),
  colors: ThemeColorsSchema,
  radius: z.string().nullable().optional(),
  typography: ThemeTypographySchema.nullable().optional(),
});

export const GeinsSettingsSchema = z.object({
  apiKey: z.string(),
  accountName: z.string(),
  channel: z.string(),
  tld: z.string(),
  locale: z.string(),
  market: z.string(),
  environment: z.enum(['production', 'staging']).default('production'),
  availableLocales: z.array(z.string()).default([]),
  availableMarkets: z.array(z.string()).default([]),
});

/**
 * URL validator that accepts only HTTP(S) URLs.
 * Rejects javascript:, data:, and other non-HTTP protocols.
 * Empty strings are also rejected (use .nullable().optional() on the field).
 */
const SafeUrlSchema = z.string().refine(
  (val) => {
    try {
      return ['https:', 'http:'].includes(new URL(val).protocol);
    } catch {
      return false;
    }
  },
  { message: 'Must be a valid HTTP(S) URL' },
);

export const BrandingConfigSchema = z.object({
  name: z.string(),
  watermark: z.enum(['full', 'minimal', 'none']),
  logoUrl: SafeUrlSchema.nullable().optional(),
  logoDarkUrl: SafeUrlSchema.nullable().optional(),
  logoSymbolUrl: SafeUrlSchema.nullable().optional(),
  faviconUrl: SafeUrlSchema.nullable().optional(),
  ogImageUrl: SafeUrlSchema.nullable().optional(),
});

/**
 * Feature access control — who can access a feature.
 * - "all": everyone
 * - "authenticated": logged-in users only
 * - { group: "staff" }: specific user group
 * - { role: "order_placer" }: specific role
 * - { accountType: "enterprise" }: specific account type
 */
export const FeatureAccessSchema = z.union([
  z.literal('all'),
  z.literal('authenticated'),
  z.object({ group: z.string() }),
  z.object({ role: z.string() }),
  z.object({ permission: z.string() }),
  z.object({ accountType: z.string() }),
]);

export const FeatureConfigSchema = z.object({
  enabled: z.boolean(),
  access: FeatureAccessSchema.optional(),
});

/**
 * Meta keywords arrive from the merchant API as a single comma-separated
 * string (the Studio "Default keywords" field is free text, e.g.
 * "shoes,boots,sneakers"). Older configs and our own fixtures use a string
 * array. Accept both and normalise to a trimmed array with empties dropped so
 * every consumer renders one shape: "" / [] -> [], absent stays absent,
 * explicit null stays null. Splitting and trimming preserves the merchant's
 * terms verbatim; only the comma delimiter and surrounding whitespace go.
 */
function normalizeKeywords(
  input: string | string[] | null | undefined,
): string[] | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  const parts = Array.isArray(input) ? input : [input];
  return parts
    .flatMap((part) => part.split(','))
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

export const SeoConfigSchema = z.object({
  defaultTitle: z.string().nullable().optional(),
  titleTemplate: z.string().nullable().optional(),
  defaultDescription: z.string().nullable().optional(),
  // Merchant API sends a comma-separated string; arrays are accepted for
  // back-compat. Normalised to string[] via normalizeKeywords.
  defaultKeywords: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional()
    .transform(normalizeKeywords),
  robots: z.string().nullable().optional(),
  googleAnalyticsId: z.string().nullable().optional(),
  googleTagManagerId: z.string().nullable().optional(),
  // Google Search Console verification token (the Studio "Search console
  // verification" field). Sent by the merchant API as a flat string and
  // rendered as the google-site-verification meta.
  verification: z.string().nullable().optional(),
});

export const ContactAddressSchema = z.object({
  street: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
});

export const ContactSocialSchema = z.object({
  facebook: SafeUrlSchema.nullable().optional(),
  instagram: SafeUrlSchema.nullable().optional(),
  twitter: SafeUrlSchema.nullable().optional(),
  linkedin: SafeUrlSchema.nullable().optional(),
  youtube: SafeUrlSchema.nullable().optional(),
});

export const ContactConfigSchema = z.object({
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: ContactAddressSchema.nullable().optional(),
  social: ContactSocialSchema.nullable().optional(),
});

export const OverrideConfigSchema = z
  .object({
    css: z.record(z.string(), z.string()).nullable().optional(),
    features: z.record(z.string(), FeatureConfigSchema).nullable().optional(),
  })
  .nullable()
  .optional();

/**
 * CMS slot + menu config carried through the merchant API's `appSettings.cms`
 * block. Loosely typed here (record-of-record) — the strict shape lives in
 * `shared/types/cms-slots.ts` and `shared/constants/cms.ts`.
 */
const CmsConfigSchema = z
  .object({
    slots: z
      .record(
        z.string(),
        z.object({
          family: z.string(),
          areaName: z.string(),
        }),
      )
      .optional(),
    menus: z
      .record(
        z.string(),
        z.object({
          menuLocationId: z.string(),
        }),
      )
      .optional(),
  })
  .optional();

/**
 * Tenant mode. Merchant admin has historically emitted both `catalog`
 * (US) and `catalogue` (UK) spellings; we normalise to `catalog` so
 * downstream code only sees one. `z.preprocess` runs before validation
 * so unknown values still fail enum validation cleanly.
 */
export const TenantModeSchema = z.preprocess(
  (v) => (v === 'catalogue' ? 'catalog' : v),
  z.enum(['commerce', 'catalog']),
);

/**
 * Complete Store Settings schema — the contract the sales portal expects from the merchant API.
 */
export const StoreSettingsSchema = z.object({
  tenantId: z.string(),
  hostname: z.string(),
  aliases: z.array(z.string()).optional(),
  geinsSettings: GeinsSettingsSchema,
  mode: TenantModeSchema,
  checkoutMode: z.enum(['custom', 'hosted']).default('custom'),
  theme: ThemeConfigSchema,
  branding: BrandingConfigSchema,
  features: z.record(z.string(), FeatureConfigSchema).default({}),
  seo: SeoConfigSchema.nullable().optional(),
  contact: ContactConfigSchema.nullable().optional(),
  overrides: OverrideConfigSchema,
  cms: CmsConfigSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Inferred types from Zod schemas
export type StoreSettings = z.infer<typeof StoreSettingsSchema>;
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type ThemeTypography = z.infer<typeof ThemeTypographySchema>;
export type GeinsSettings = z.infer<typeof GeinsSettingsSchema>;
export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
export type FeatureAccess = z.infer<typeof FeatureAccessSchema>;
export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;
export type SeoConfig = z.infer<typeof SeoConfigSchema>;
export type ContactConfig = z.infer<typeof ContactConfigSchema>;
export type OverrideConfig = z.infer<typeof OverrideConfigSchema>;
