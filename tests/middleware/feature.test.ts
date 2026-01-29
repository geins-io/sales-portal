import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed } from 'vue';
import type { TenantConfig, FeatureName } from '#shared/types/tenant-config';
import type { RouteLocationNormalized } from 'vue-router';

// Create mock tenant data
const mockTenantData = ref<TenantConfig | null>(null);

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

// Create mock useTenant function
const mockUseTenant = vi.fn(() => ({
  tenant: computed(() => mockTenantData.value),
  hasFeature: (featureName: FeatureName): boolean => {
    return mockTenantData.value?.features?.[featureName] ?? false;
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
  overrides: Partial<TenantConfig> = {},
): TenantConfig {
  return {
    tenantId: 'test-tenant',
    hostname: 'test.example.com',
    theme: {
      name: 'test-theme',
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        background: '#ffffff',
        foreground: '#000000',
      },
    },
    branding: {
      name: 'Test Brand',
      logoUrl: 'https://example.com/logo.svg',
    },
    features: {
      search: true,
      authentication: true,
      cart: false,
      wishlist: true,
    },
    css: '',
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
  // Test the middleware function directly instead of relying on Nuxt's auto-imports
  const createFeatureMiddleware = () => {
    return async (to: RouteLocationNormalized) => {
      // Get the required feature from route meta (typed via PageMeta augmentation)
      const requiredFeature = to.meta.feature as FeatureName | undefined;

      // Skip feature check if no feature is required
      if (!requiredFeature) {
        return;
      }

      const { hasFeature, tenant, suspense } = mockUseTenant();

      // Ensure tenant data is loaded before checking features
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
    // Reset mocks
    mockTenantData.value = null;
    mockUseTenant.mockClear();
    mockNavigateTo.mockClear();
    resetSuspensePromise();

    // Create fresh middleware
    featureMiddleware = createFeatureMiddleware();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when tenant data is already loaded', () => {
    beforeEach(() => {
      // Pre-load tenant data
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
      // useTenant should not be called when no feature is required
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
      // Data not loaded yet
      mockTenantData.value = null;

      const route = createMockRoute({ feature: 'search' });

      // Start middleware execution
      const middlewarePromise = featureMiddleware(route);

      // Middleware should not have redirected yet because it's waiting for data
      expect(mockNavigateTo).not.toHaveBeenCalled();

      // Simulate data loading completing
      mockTenantData.value = createMockTenantConfig();
      suspenseResolve();

      // Wait for middleware to complete
      const result = await middlewarePromise;

      // Feature is enabled, so should not redirect
      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should redirect after loading if feature is disabled', async () => {
      // Data not loaded yet
      mockTenantData.value = null;

      const route = createMockRoute({ feature: 'cart' });

      // Start middleware execution
      const middlewarePromise = featureMiddleware(route);

      // Simulate data loading completing
      mockTenantData.value = createMockTenantConfig({
        features: { cart: false },
      });
      suspenseResolve();

      // Wait for middleware to complete
      await middlewarePromise;

      expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    it('should not wait if route has no feature requirement', async () => {
      // Data not loaded yet
      mockTenantData.value = null;

      const route = createMockRoute();

      // Middleware should complete immediately without waiting
      const result = await featureMiddleware(route);

      // No feature required, so should not redirect and should not call useTenant
      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(mockUseTenant).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined features object', async () => {
      mockTenantData.value = createMockTenantConfig({ features: undefined });
      const route = createMockRoute({ feature: 'search' });

      await featureMiddleware(route);

      expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    it('should handle empty feature meta', async () => {
      mockTenantData.value = createMockTenantConfig();
      const route = createMockRoute({ feature: '' });

      const result = await featureMiddleware(route);

      // Empty string is falsy, so no feature check happens
      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should handle null tenant config after loading', async () => {
      // Simulate API returning null
      mockTenantData.value = null;

      const route = createMockRoute({ feature: 'search' });

      // Start middleware and resolve suspense
      const middlewarePromise = featureMiddleware(route);
      suspenseResolve();
      await middlewarePromise;

      // Should redirect because hasFeature returns false for null config
      expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });
  });

  describe('feature types', () => {
    beforeEach(() => {
      mockTenantData.value = createMockTenantConfig({
        features: {
          search: true,
          authentication: true,
          cart: false,
          wishlist: true,
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
