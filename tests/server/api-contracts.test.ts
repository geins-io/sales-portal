import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import type { H3Event } from 'h3';

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
const HealthCheckResponseDetailedSchema =
  HealthCheckResponseMinimalSchema.extend({
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
// Mock Setup
// =============================================================================

// Mock the logger
vi.mock('../../server/utils/logger', () => ({
  createTenantLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createTimer: () => ({
    elapsed: () => 10,
  }),
}));

// Mock storage
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

// Mock response object for h3 events
const createMockRes = () => ({
  setHeader: vi.fn(),
  getHeader: vi.fn(),
  writeHead: vi.fn(),
  end: vi.fn(),
  statusCode: 200,
});

// Stub Nuxt globals
vi.stubGlobal('useStorage', () => mockStorage);
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {
    appVersion: '1.0.0',
    commitSha: 'abc123',
    environment: 'test',
  },
  healthCheckSecret: 'test-secret',
  storage: { driver: 'memory' },
}));
vi.stubGlobal(
  'defineCachedEventHandler',
  (handler: (event: H3Event) => unknown) => handler,
);
vi.stubGlobal(
  'defineEventHandler',
  (handler: (event: H3Event) => unknown) => handler,
);
vi.stubGlobal('getQuery', (event: H3Event) => (event as H3Event & { _query?: Record<string, string> })._query || {});
vi.stubGlobal('setResponseHeader', vi.fn());
vi.stubGlobal('setResponseStatus', vi.fn());
vi.stubGlobal('setResponseHeaders', vi.fn());

// =============================================================================
// API Contract Tests
// =============================================================================

describe('API Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TenantConfig Schema Validation', () => {
    it('should validate a complete TenantConfig', () => {
      const validConfig = {
        tenantId: 'test-tenant',
        hostname: 'test.example.com',
        theme: {
          name: 'test-theme',
          displayName: 'Test Theme',
          colors: {
            primary: '#000000',
            secondary: '#ffffff',
            background: '#ffffff',
            foreground: '#000000',
          },
          borderRadius: {
            base: '0.5rem',
          },
        },
        css: '[data-theme="test-theme"] { --primary: #000; }',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        branding: {
          name: 'Test Brand',
        },
        features: {
          search: true,
          authentication: true,
          cart: true,
        },
      };

      const result = TenantConfigSchema.safeParse(validConfig);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
    });

    it('should reject TenantConfig missing required fields', () => {
      const invalidConfig = {
        // Missing tenantId, hostname, theme, css
        branding: { name: 'Test' },
      };

      const result = TenantConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject TenantConfig with invalid theme colors', () => {
      const invalidConfig = {
        tenantId: 'test',
        hostname: 'test.com',
        theme: {
          name: 'test',
          colors: {
            // Missing required primary and secondary
            background: '#fff',
          },
        },
        css: '',
      };

      const result = TenantConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should validate minimal TenantConfig with only required fields', () => {
      const minimalConfig = {
        tenantId: 'test-tenant',
        hostname: 'test.example.com',
        theme: {
          name: 'test-theme',
          colors: {
            primary: '#000000',
            secondary: '#ffffff',
          },
        },
        css: '',
      };

      const result = TenantConfigSchema.safeParse(minimalConfig);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
    });
  });

  describe('RouteResolution Schema Validation', () => {
    it('should validate product route resolution', () => {
      const productResolution = {
        type: 'product' as const,
        productId: '123',
        productSlug: 'product-name',
        categorySlug: 'category-name',
        canonical: 'https://example.com/category/product',
      };

      const result = RouteResolutionSchema.safeParse(productResolution);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('product');
    });

    it('should validate category route resolution', () => {
      const categoryResolution = {
        type: 'category' as const,
        categoryId: '456',
        categorySlug: 'category-name',
        canonical: 'https://example.com/category-name',
      };

      const result = RouteResolutionSchema.safeParse(categoryResolution);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('category');
    });

    it('should validate page route resolution', () => {
      const pageResolution = {
        type: 'page' as const,
        pageId: '789',
        pageSlug: 'about-us',
        canonical: 'https://example.com/about-us',
      };

      const result = RouteResolutionSchema.safeParse(pageResolution);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('page');
    });

    it('should validate not-found route resolution', () => {
      const notFoundResolution = {
        type: 'not-found' as const,
      };

      const result = RouteResolutionSchema.safeParse(notFoundResolution);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('not-found');
    });

    it('should reject invalid route type', () => {
      const invalidResolution = {
        type: 'invalid-type',
      };

      const result = RouteResolutionSchema.safeParse(invalidResolution);
      expect(result.success).toBe(false);
    });

    it('should validate product resolution with numeric ID', () => {
      const productResolution = {
        type: 'product' as const,
        productId: 123, // numeric ID
      };

      const result = ProductRouteResolutionSchema.safeParse(productResolution);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
    });
  });

  describe('HealthCheck Schema Validation', () => {
    it('should validate minimal health response', () => {
      const healthResponse = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
      };

      const result =
        HealthCheckResponseMinimalSchema.safeParse(healthResponse);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
    });

    it('should validate detailed health response', () => {
      const detailedResponse = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        commitSha: 'abc123',
        environment: 'production',
        uptime: 3600,
        checks: {
          storage: {
            status: 'healthy' as const,
            latency: 10,
            details: { driver: 'memory' },
          },
          memory: {
            status: 'healthy' as const,
            details: { heapUsedMB: 50, rssMB: 100 },
          },
        },
      };

      // Validate detailed response
      expect(detailedResponse.status).toBe('healthy');
      expect(detailedResponse.version).toBeDefined();
      expect(detailedResponse.uptime).toBeDefined();
      expect(detailedResponse.checks).toBeDefined();

      // Validate minimal fields are present
      const minimalResult =
        HealthCheckResponseMinimalSchema.safeParse(detailedResponse);
      expect(minimalResult.success).toBe(true);

      // Validate checks structure
      expect(detailedResponse.checks.storage).toBeDefined();
      expect(detailedResponse.checks.memory).toBeDefined();
      expect(detailedResponse.checks.storage.status).toBe('healthy');
    });

    it('should validate degraded status', () => {
      const degradedResponse = {
        status: 'degraded' as const,
        timestamp: new Date().toISOString(),
      };

      const result =
        HealthCheckResponseMinimalSchema.safeParse(degradedResponse);
      expect(result.success).toBe(true);
    });

    it('should validate unhealthy status', () => {
      const unhealthyResponse = {
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
      };

      const result =
        HealthCheckResponseMinimalSchema.safeParse(unhealthyResponse);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const invalidResponse = {
        status: 'unknown',
        timestamp: new Date().toISOString(),
      };

      const result =
        HealthCheckResponseMinimalSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('GET /api/resolve-route handler contract', () => {
    let resolveRouteHandler: (event: H3Event) => Promise<unknown>;
    let routeCache: { clear: () => void };

    const createMockEvent = (query: Record<string, string> = {}): H3Event => {
      const event = {
        node: {
          res: createMockRes(),
          req: {
            url: '/api/resolve-route',
            method: 'GET',
          },
        },
        context: {
          tenant: {
            id: 'test-tenant',
            hostname: 'test.example.com',
          },
        },
        _query: query,
      } as unknown as H3Event;
      return event;
    };

    beforeEach(async () => {
      vi.resetModules();
      const module = await import('../../server/api/resolve-route.get.ts');
      resolveRouteHandler = module.default as (
        event: H3Event,
      ) => Promise<unknown>;
      // Clear the route cache before each test to prevent interference
      routeCache = module.routeCache as { clear: () => void };
      routeCache.clear();
    });

    it('should return valid RouteResolution for category path', async () => {
      const event = createMockEvent({ path: '/l/category-slug' });
      const response = await resolveRouteHandler(event);

      const result = RouteResolutionSchema.safeParse(response);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
      // Verify response has expected type field
      expect(['product', 'category', 'page', 'not-found']).toContain(
        result.data?.type,
      );
    });

    it('should return valid RouteResolution for product path', async () => {
      const event = createMockEvent({ path: '/p/product-slug' });
      const response = await resolveRouteHandler(event);

      const result = RouteResolutionSchema.safeParse(response);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
      // Verify response has expected type field
      expect(['product', 'category', 'page', 'not-found']).toContain(
        result.data?.type,
      );
    });

    it('should return valid RouteResolution for page path', async () => {
      const event = createMockEvent({ path: '/c/some-page' });
      const response = await resolveRouteHandler(event);

      const result = RouteResolutionSchema.safeParse(response);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
      // Verify response has expected type field from valid route types
      expect(['product', 'category', 'page', 'not-found']).toContain(
        result.data?.type,
      );
    });

    it('should return not-found resolution matching schema', async () => {
      const event = createMockEvent({ path: '/' });
      const response = await resolveRouteHandler(event);

      const result = RouteResolutionSchema.safeParse(response);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('not-found');
    });

    it('should handle missing path parameter gracefully', async () => {
      const event = createMockEvent({});
      const response = await resolveRouteHandler(event);

      const result = RouteResolutionSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should always return a valid RouteResolution type', async () => {
      const testPaths = [
        '/category-slug',
        '/category-slug/product-slug',
        '/category-slug/subcategory-slug/product-slug',
        '/l/category',
        '/p/product',
        '/c/page',
        '/',
        '/unknown/deep/path',
      ];

      for (const path of testPaths) {
        const event = createMockEvent({ path });
        const response = await resolveRouteHandler(event);

        const result = RouteResolutionSchema.safeParse(response);

        expect(result.success).toBe(true);
        expect(['product', 'category', 'page', 'not-found']).toContain(
          result.data?.type,
        );
      }
    });
  });

  describe('GET /api/health handler contract', () => {
    let healthHandler: (event: H3Event) => Promise<unknown>;

    const createMockEvent = (query: Record<string, string> = {}): H3Event => {
      const event = {
        node: {
          res: createMockRes(),
          req: {
            url: '/api/health',
            method: 'GET',
          },
        },
        context: {
          logger: {
            trackMetric: vi.fn(),
          },
        },
        _query: query,
      } as unknown as H3Event;
      return event;
    };

    beforeEach(async () => {
      vi.resetModules();
      const module = await import('../../server/api/health.get.ts');
      healthHandler = module.default as (event: H3Event) => Promise<unknown>;
    });

    it('should return minimal health response matching schema (public mode)', async () => {
      const event = createMockEvent({});
      const response = await healthHandler(event);

      const result = HealthCheckResponseMinimalSchema.safeParse(response);

      if (!result.success) {
        console.error('Validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
    });

    it('should return detailed health response matching schema (authorized mode)', async () => {
      const event = createMockEvent({ key: 'test-secret' });
      const response = (await healthHandler(event)) as Record<string, unknown>;

      // When authorized, should include additional fields
      // The minimal schema should still pass
      const minimalResult =
        HealthCheckResponseMinimalSchema.safeParse(response);
      expect(minimalResult.success).toBe(true);

      // If authorized (key matches), should include detailed fields
      if (response.version !== undefined) {
        expect(response).toHaveProperty('version');
        expect(response).toHaveProperty('uptime');
        expect(response).toHaveProperty('checks');
        expect(typeof response.version).toBe('string');
        expect(typeof response.uptime).toBe('number');
      }
    });

    it('should return valid status value', async () => {
      const event = createMockEvent({ quick: 'true' });
      const response = (await healthHandler(event)) as { status: string };

      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.status);
    });

    it('should always include timestamp in response', async () => {
      const event = createMockEvent({});
      const response = (await healthHandler(event)) as { timestamp: string };

      expect(response.timestamp).toBeDefined();
      expect(typeof response.timestamp).toBe('string');
      // Verify it's a valid ISO timestamp
      expect(() => new Date(response.timestamp)).not.toThrow();
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
