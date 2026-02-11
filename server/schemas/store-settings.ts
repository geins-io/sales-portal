import { z } from 'zod';

/**
 * OKLCH color format validator.
 * Accepts oklch(L C H) where L is 0-1, C is 0-0.4, H is 0-360.
 * Also accepts plain values like "oklch(0.5 0.2 200)" with flexible whitespace.
 */
const oklchRegex = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)$/;

const OklchColorSchema = z
  .string()
  .regex(oklchRegex, 'Must be in oklch(L C H) format');

/**
 * Theme Colors — 6 required core colors, 26 optional (derived server-side if null/omitted).
 * API sends null for omitted optional colors.
 */
export const ThemeColorsSchema = z.object({
  // 6 required core colors
  primary: OklchColorSchema,
  primaryForeground: OklchColorSchema,
  secondary: OklchColorSchema,
  secondaryForeground: OklchColorSchema,
  background: OklchColorSchema,
  foreground: OklchColorSchema,

  // 26 optional colors (null from API = derive server-side)
  card: OklchColorSchema.nullable().optional(),
  cardForeground: OklchColorSchema.nullable().optional(),
  popover: OklchColorSchema.nullable().optional(),
  popoverForeground: OklchColorSchema.nullable().optional(),
  muted: OklchColorSchema.nullable().optional(),
  mutedForeground: OklchColorSchema.nullable().optional(),
  accent: OklchColorSchema.nullable().optional(),
  accentForeground: OklchColorSchema.nullable().optional(),
  destructive: OklchColorSchema.nullable().optional(),
  destructiveForeground: OklchColorSchema.nullable().optional(),
  border: OklchColorSchema.nullable().optional(),
  input: OklchColorSchema.nullable().optional(),
  ring: OklchColorSchema.nullable().optional(),
  chart1: OklchColorSchema.nullable().optional(),
  chart2: OklchColorSchema.nullable().optional(),
  chart3: OklchColorSchema.nullable().optional(),
  chart4: OklchColorSchema.nullable().optional(),
  chart5: OklchColorSchema.nullable().optional(),
  sidebar: OklchColorSchema.nullable().optional(),
  sidebarForeground: OklchColorSchema.nullable().optional(),
  sidebarPrimary: OklchColorSchema.nullable().optional(),
  sidebarPrimaryForeground: OklchColorSchema.nullable().optional(),
  sidebarAccent: OklchColorSchema.nullable().optional(),
  sidebarAccentForeground: OklchColorSchema.nullable().optional(),
  sidebarBorder: OklchColorSchema.nullable().optional(),
  sidebarRing: OklchColorSchema.nullable().optional(),
});

export const ThemeTypographySchema = z.object({
  fontFamily: z.string(),
  headingFontFamily: z.string().nullable().optional(),
  monoFontFamily: z.string().nullable().optional(),
});

export const ThemeConfigSchema = z.object({
  name: z.string(),
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
  environment: z.enum(['production', 'staging']),
});

export const BrandingConfigSchema = z.object({
  name: z.string(),
  watermark: z.enum(['full', 'minimal', 'none']),
  logoUrl: z.string().nullable().optional(),
  logoDarkUrl: z.string().nullable().optional(),
  logoSymbolUrl: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  ogImageUrl: z.string().nullable().optional(),
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
  z.object({ accountType: z.string() }),
]);

export const FeatureConfigSchema = z.object({
  enabled: z.boolean(),
  access: FeatureAccessSchema.optional(),
});

export const SeoConfigSchema = z.object({
  defaultTitle: z.string().nullable().optional(),
  titleTemplate: z.string().nullable().optional(),
  defaultDescription: z.string().nullable().optional(),
  defaultKeywords: z.array(z.string()).nullable().optional(),
  robots: z.string().nullable().optional(),
  googleAnalyticsId: z.string().nullable().optional(),
  googleTagManagerId: z.string().nullable().optional(),
  verification: z
    .object({
      google: z.string().nullable().optional(),
      bing: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const ContactAddressSchema = z.object({
  street: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
});

export const ContactSocialSchema = z.object({
  facebook: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  twitter: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  youtube: z.string().nullable().optional(),
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
 * Complete Store Settings schema — the contract the sales portal expects from the merchant API.
 */
export const StoreSettingsSchema = z.object({
  tenantId: z.string(),
  hostname: z.string(),
  aliases: z.array(z.string()).optional(),
  geinsSettings: GeinsSettingsSchema,
  mode: z.enum(['commerce', 'catalog']),
  theme: ThemeConfigSchema,
  branding: BrandingConfigSchema,
  features: z.record(z.string(), FeatureConfigSchema),
  seo: SeoConfigSchema.nullable().optional(),
  contact: ContactConfigSchema.nullable().optional(),
  overrides: OverrideConfigSchema,
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
