import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import { setup, $fetch } from '@nuxt/test-utils/e2e';

// =============================================================================
// Zod Schemas - Define expected API response shapes
// =============================================================================

/**
 * Theme Colors Schema
 * Based on ThemeColors interface from shared/types/tenant-config.ts
 */
const ThemeColorsSchema = z.object({
  primary: z.string(),
  primaryForeground: z.string().optional(),
  secondary: z.string(),
  secondaryForeground: z.string().optional(),
  background: z.string().optional(),
  foreground: z.string().optional(),
  muted: z.string().optional(),
  mutedForeground: z.string().optional(),
  accent: z.string().optional(),
  accentForeground: z.string().optional(),
  destructive: z.string().optional(),
  border: z.string().optional(),
  input: z.string().optional(),
  ring: z.string().optional(),
  card: z.string().optional(),
  cardForeground: z.string().optional(),
  popover: z.string().optional(),
  popoverForeground: z.string().optional(),
});

/**
 * Theme Typography Schema
 */
const ThemeTypographySchema = z
  .object({
    fontFamily: z.string().optional(),
    headingFontFamily: z.string().optional(),
    baseFontSize: z.string().optional(),
  })
  .optional();

/**
 * Theme Border Radius Schema
 */
const ThemeBorderRadiusSchema = z
  .object({
    base: z.string().optional(),
    sm: z.string().optional(),
    md: z.string().optional(),
    lg: z.string().optional(),
    xl: z.string().optional(),
  })
  .optional();

/**
 * Tenant Theme Schema
 * Based on TenantTheme interface from shared/types/tenant-config.ts
 */
const TenantThemeSchema = z.object({
  name: z.string(),
  displayName: z.string().optional(),
  colors: ThemeColorsSchema,
  typography: ThemeTypographySchema,
  borderRadius: ThemeBorderRadiusSchema,
  customProperties: z.record(z.string()).optional(),
});

/**
 * Geins Settings Schema
 */
const GeinsSettingsSchema = z
  .object({
    apiKey: z.string(),
    accountName: z.string(),
    channel: z.string(),
    tld: z.string(),
    locale: z.string(),
    market: z.string(),
    environment: z.enum(['production', 'staging']).optional(),
  })
  .optional();

/**
 * Tenant Branding Schema
 */
const TenantBrandingSchema = z
  .object({
    name: z.string(),
    logoUrl: z.string().optional(),
    logoDarkUrl: z.string().optional(),
    logoSymbolUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    ogImageUrl: z.string().optional(),
  })
  .optional();

/**
 * Tenant Features Schema
 */
const TenantFeaturesSchema = z
  .object({
    search: z.boolean().optional(),
    authentication: z.boolean().optional(),
    cart: z.boolean().optional(),
    wishlist: z.boolean().optional(),
    productComparison: z.boolean().optional(),
    multiLanguage: z.boolean().optional(),
    newsletter: z.boolean().optional(),
  })
  .optional();

/**
 * Tenant SEO Schema
 */
const TenantSeoSchema = z
  .object({
    defaultTitle: z.string().optional(),
    titleTemplate: z.string().optional(),
    defaultDescription: z.string().optional(),
    defaultKeywords: z.array(z.string()).optional(),
    googleAnalyticsId: z.string().optional(),
    googleTagManagerId: z.string().optional(),
  })
  .optional();

/**
 * Tenant Contact Schema
 */
const TenantContactSchema = z
  .object({
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    social: z
      .object({
        facebook: z.string().optional(),
        instagram: z.string().optional(),
        twitter: z.string().optional(),
        linkedin: z.string().optional(),
        youtube: z.string().optional(),
      })
      .optional(),
  })
  .optional();

/**
 * Complete TenantConfig Schema
 * Based on TenantConfig interface from shared/types/tenant-config.ts
 */
const TenantConfigSchema = z.object({
  tenantId: z.string(),
  hostname: z.string(),
  aliases: z.array(z.string()).optional(),
  geinsSettings: GeinsSettingsSchema,
  theme: TenantThemeSchema,
  branding: TenantBrandingSchema,
  features: TenantFeaturesSchema,
  seo: TenantSeoSchema,
  contact: TenantContactSchema,
  css: z.string(),
  isActive: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * ID type (string or number)
 */
const IDSchema = z.union([z.string(), z.number()]);

/**
 * Product Route Resolution Schema
 */
const ProductRouteResolutionSchema = z.object({
  type: z.literal('product'),
  productId: IDSchema,
  productSlug: z.string().optional(),
  categorySlug: z.string().optional(),
  canonical: z.string().optional(),
});

/**
 * Category Route Resolution Schema
 */
const CategoryRouteResolutionSchema = z.object({
  type: z.literal('category'),
  categoryId: IDSchema,
  categorySlug: z.string().optional(),
  canonical: z.string().optional(),
});

/**
 * Page Route Resolution Schema
 */
const PageRouteResolutionSchema = z.object({
  type: z.literal('page'),
  pageId: IDSchema,
  pageSlug: z.string().optional(),
  canonical: z.string().optional(),
});

/**
 * Not Found Route Resolution Schema
 */
const NotFoundRouteResolutionSchema = z.object({
  type: z.literal('not-found'),
  canonical: z.string().optional(),
});

/**
 * Union schema for all RouteResolution types
 * Based on RouteResolution type from shared/types/common.ts
 */
const RouteResolutionSchema = z.discriminatedUnion('type', [
  ProductRouteResolutionSchema,
  CategoryRouteResolutionSchema,
  PageRouteResolutionSchema,
  NotFoundRouteResolutionSchema,
]);

/**
 * Component Health Schema for individual health checks
 */
const ComponentHealthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  latency: z.number().optional(),
  message: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

/**
 * Health Check Response Schema (public/minimal response)
 * Based on actual /api/health endpoint implementation
 */
const HealthCheckResponseMinimalSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
});

/**
 * Health Check Response Schema (detailed/authorized response)
 * Based on actual /api/health endpoint implementation
 */
const HealthCheckResponseDetailedSchema = HealthCheckResponseMinimalSchema.extend({
  version: z.string(),
  commitSha: z.string(),
  environment: z.string(),
  uptime: z.number(),
  checks: z.object({
    storage: ComponentHealthSchema.optional(),
    memory: ComponentHealthSchema.optional(),
  }),
});

// =============================================================================
// API Contract Tests
// =============================================================================

describe('API Contracts', () => {
  // Setup test environment with Nuxt server
  beforeAll(async () => {
    await setup({
      server: true,
      browser: false,
    });
  }, 60000);

  describe('GET /api/config', () => {
    it('should return a valid TenantConfig schema', async () => {
      const response = await $fetch('/api/config');

      // Validate response matches TenantConfig schema
      const result = TenantConfigSchema.safeParse(response);

      if (!result.success) {
        console.error('Schema validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
    });

    it('should have required tenant identification fields', async () => {
      const response = await $fetch('/api/config');

      expect(response).toHaveProperty('tenantId');
      expect(response).toHaveProperty('hostname');
      expect(typeof response.tenantId).toBe('string');
      expect(typeof response.hostname).toBe('string');
    });

    it('should have a valid theme with required color fields', async () => {
      const response = await $fetch('/api/config');

      expect(response).toHaveProperty('theme');
      expect(response.theme).toHaveProperty('name');
      expect(response.theme).toHaveProperty('colors');
      expect(response.theme.colors).toHaveProperty('primary');
      expect(response.theme.colors).toHaveProperty('secondary');
    });

    it('should have CSS string for theming', async () => {
      const response = await $fetch('/api/config');

      expect(response).toHaveProperty('css');
      expect(typeof response.css).toBe('string');
    });
  });

  describe('GET /api/resolve-route', () => {
    it('should return a valid RouteResolution for category slug', async () => {
      const response = await $fetch('/api/resolve-route?path=/category-slug');

      // Validate response matches RouteResolution schema
      const result = RouteResolutionSchema.safeParse(response);

      if (!result.success) {
        console.error('Schema validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
    });

    it('should have a valid route type', async () => {
      const response = await $fetch('/api/resolve-route?path=/category-slug');

      expect(response).toHaveProperty('type');
      expect(['product', 'category', 'page', 'not-found']).toContain(
        response.type,
      );
    });

    it('should return category resolution for category slugs', async () => {
      const response = await $fetch('/api/resolve-route?path=/category-slug');

      expect(response.type).toBe('category');
      expect(response).toHaveProperty('categoryId');
      expect(response).toHaveProperty('categorySlug');
    });

    it('should return product resolution for product paths', async () => {
      const response = await $fetch(
        '/api/resolve-route?path=/category-slug/product-slug',
      );

      expect(response.type).toBe('product');
      expect(response).toHaveProperty('productId');

      // Validate against product schema specifically
      const result = ProductRouteResolutionSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should return page resolution for page paths', async () => {
      const response = await $fetch('/api/resolve-route?path=/c/some-page');

      expect(response.type).toBe('page');
      expect(response).toHaveProperty('pageId');

      // Validate against page schema specifically
      const result = PageRouteResolutionSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should return not-found for root path', async () => {
      const response = await $fetch('/api/resolve-route?path=/');

      expect(response.type).toBe('not-found');

      // Validate against not-found schema specifically
      const result = NotFoundRouteResolutionSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should handle missing path parameter', async () => {
      const response = await $fetch('/api/resolve-route');

      // Should return not-found or handle gracefully
      const result = RouteResolutionSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should normalize paths correctly', async () => {
      // Path with trailing slash should be normalized
      const response = await $fetch(
        '/api/resolve-route?path=/category-slug/',
      );

      const result = RouteResolutionSchema.safeParse(response);
      expect(result.success).toBe(true);
      expect(response.type).toBe('category');
    });
  });

  describe('GET /api/health', () => {
    it('should return a valid minimal HealthCheckResponse schema (public)', async () => {
      const response = await $fetch('/api/health');

      // Validate response matches minimal schema (public mode)
      const result = HealthCheckResponseMinimalSchema.safeParse(response);

      if (!result.success) {
        console.error('Schema validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
    });

    it('should have required public health fields', async () => {
      const response = await $fetch('/api/health');

      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.status);
      expect(typeof response.timestamp).toBe('string');
    });

    it('should return healthy or degraded status in quick mode', async () => {
      const response = await $fetch('/api/health?quick=true');

      const result = HealthCheckResponseMinimalSchema.safeParse(response);
      expect(result.success).toBe(true);
      // Quick mode should typically return healthy (skips storage check)
      expect(['healthy', 'degraded']).toContain(response.status);
    });
  });
});

// =============================================================================
// Schema Export for Reuse
// =============================================================================

export {
  TenantConfigSchema,
  TenantThemeSchema,
  ThemeColorsSchema,
  RouteResolutionSchema,
  ProductRouteResolutionSchema,
  CategoryRouteResolutionSchema,
  PageRouteResolutionSchema,
  NotFoundRouteResolutionSchema,
  HealthCheckResponseMinimalSchema,
  HealthCheckResponseDetailedSchema,
  ComponentHealthSchema,
};
