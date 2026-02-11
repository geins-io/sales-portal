import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed } from 'vue';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import type { RouteLocationNormalized } from 'vue-router';

// Create mock tenant data
const mockTenantData = ref<PublicTenantConfig | null>(null);

// Track suspense calls
let suspenseResolve: () => void;
let suspensePromise: Promise<void>;

const resetSuspensePromise = () => {
  suspensePromise = new Promise<void>((resolve) => {
    suspenseResolve = () => resolve();
  });
};

// Initialize suspense promise
resetSuspensePromise();

// Create mock useTenant function (new features shape: Record<string, { enabled, access? }>)
const mockUseTenant = vi.fn(() => ({
  tenant: computed(() => mockTenantData.value),
  hasFeature: (featureName: string): boolean => {
    const feature = mockTenantData.value?.features?.[featureName];
    if (!feature) return false;
    return feature.enabled;
  },
  suspense: () => suspensePromise,
}));

// Mock navigateTo
const mockNavigateTo = vi.fn((path: string) => {
  return { path };
});

// Mock the Nuxt auto-imports at module level
vi.mock('#app', () => ({
  navigateTo: (path: string) => mockNavigateTo(path),
}));

vi.mock('#imports', () => ({
  navigateTo: (path: string) => mockNavigateTo(path),
  useTenant: () => mockUseTenant(),
}));

// Mock the composables module
vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => mockUseTenant(),
}));

// Create mock tenant config for tests
function createMockTenantConfig(
  overrides: Partial<PublicTenantConfig> = {},
): PublicTenantConfig {
  return {
    tenantId: 'test-tenant',
    hostname: 'test.example.com',
    mode: 'commerce',
    theme: {
      name: 'test-theme',
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        background: '#ffffff',
        foreground: '#000000',
        primaryForeground: '#ffffff',
        secondaryForeground: '#000000',
      },
      radius: '0.625rem',
    },
    branding: {
      name: 'Test Brand',
      watermark: 'full',
      logoUrl: 'https://example.com/logo.svg',
    },
    features: {
      search: { enabled: true },
      authentication: { enabled: true },
      cart: { enabled: false },
      wishlist: { enabled: true },
    },
    css: '',
    isActive: true,
    availableLocales: [],
    ...overrides,
  };
}

// Helper to create mock route
function createMockRoute(
  meta: Record<string, unknown> = {},
): RouteLocationNormalized {
  return {
    path: '/test',
    name: 'test',
    params: {},
    query: {},
    hash: '',
    fullPath: '/test',
    matched: [],
    redirectedFrom: undefined,
    meta,
  };
}

describe('feature middleware', () => {
  const createFeatureMiddleware = () => {
    return async (to: RouteLocationNormalized) => {
      const requiredFeature = to.meta.feature as string | undefined;

      if (!requiredFeature) {
        return;
      }

      const { hasFeature, tenant, suspense } = mockUseTenant();

      if (!tenant.value) {
        await suspense();
      }

      if (!hasFeature(requiredFeature)) {
        return mockNavigateTo('/');
      }
    };
  };

  let featureMiddleware: ReturnType<typeof createFeatureMiddleware>;

  beforeEach(() => {
    mockTenantData.value = null;
    mockUseTenant.mockClear();
    mockNavigateTo.mockClear();
    resetSuspensePromise();

    featureMiddleware = createFeatureMiddleware();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when tenant data is already loaded', () => {
    beforeEach(() => {
      mockTenantData.value = createMockTenantConfig();
    });

    it('should allow access when feature is enabled', async () => {
      const route = createMockRoute({ feature: 'search' });

      const result = await featureMiddleware(route);

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should redirect when feature is disabled', async () => {
      const route = createMockRoute({ feature: 'cart' });

      await featureMiddleware(route);

      expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    it('should allow access when no feature is required', async () => {
      const route = createMockRoute();

      const result = await featureMiddleware(route);

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(mockUseTenant).not.toHaveBeenCalled();
    });

    it('should redirect when feature does not exist in config', async () => {
      const route = createMockRoute({ feature: 'nonexistent' });

      await featureMiddleware(route);

      expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });
  });

  describe('when tenant data is not yet loaded', () => {
    it('should wait for tenant data before checking feature', async () => {
      mockTenantData.value = null;

      const route = createMockRoute({ feature: 'search' });

      const middlewarePromise = featureMiddleware(route);

      expect(mockNavigateTo).not.toHaveBeenCalled();

      mockTenantData.value = createMockTenantConfig();
      suspenseResolve();

      const result = await middlewarePromise;

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should redirect after loading if feature is disabled', async () => {
      mockTenantData.value = null;

      const route = createMockRoute({ feature: 'cart' });

      const middlewarePromise = featureMiddleware(route);

      mockTenantData.value = createMockTenantConfig({
        features: { cart: { enabled: false } },
      });
      suspenseResolve();

      await middlewarePromise;

      expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    it('should not wait if route has no feature requirement', async () => {
      mockTenantData.value = null;

      const route = createMockRoute();

      const result = await featureMiddleware(route);

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(mockUseTenant).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined features object', async () => {
      mockTenantData.value = createMockTenantConfig({
        features: undefined,
      } as Partial<PublicTenantConfig>);
      const route = createMockRoute({ feature: 'search' });

      await featureMiddleware(route);

      expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    it('should handle empty feature meta', async () => {
      mockTenantData.value = createMockTenantConfig();
      const route = createMockRoute({ feature: '' });

      const result = await featureMiddleware(route);

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should handle null tenant config after loading', async () => {
      mockTenantData.value = null;

      const route = createMockRoute({ feature: 'search' });

      const middlewarePromise = featureMiddleware(route);
      suspenseResolve();
      await middlewarePromise;

      expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });
  });

  describe('feature types', () => {
    beforeEach(() => {
      mockTenantData.value = createMockTenantConfig({
        features: {
          search: { enabled: true },
          authentication: { enabled: true },
          cart: { enabled: false },
          wishlist: { enabled: true },
        },
      });
    });

    it('should check search feature correctly', async () => {
      const route = createMockRoute({ feature: 'search' });
      const result = await featureMiddleware(route);

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should check authentication feature correctly', async () => {
      const route = createMockRoute({ feature: 'authentication' });
      const result = await featureMiddleware(route);

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should check cart feature correctly', async () => {
      const route = createMockRoute({ feature: 'cart' });
      await featureMiddleware(route);

      expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    it('should check wishlist feature correctly', async () => {
      const route = createMockRoute({ feature: 'wishlist' });
      const result = await featureMiddleware(route);

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });
  });
});
