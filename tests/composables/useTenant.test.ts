import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import type { TenantConfig } from '#shared/types/tenant-config';

// Create mock useFetch function
const mockData = ref<TenantConfig | null>(null);
const mockPending = ref(false);
const mockError = ref<Error | null>(null);
const mockRefresh = vi.fn();

const mockApi = vi.fn();
const mockUseFetch = vi.fn(() => ({
  data: mockData,
  pending: mockPending,
  error: mockError,
  refresh: mockRefresh,
}));

// Mock the Nuxt auto-imports at the module level
vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

vi.mock('#app', () => ({
  useNuxtApp: () => ({ $api: mockApi }),
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

// Stub globals for direct access
vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));
vi.stubGlobal('useNuxtApp', () => ({ $api: mockApi }));

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

describe('useTenant', () => {
  let useTenant: typeof import('../../app/composables/useTenant').useTenant;

  beforeEach(async () => {
    // Reset mocks
    mockData.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockRefresh.mockClear();
    mockUseFetch.mockClear();

    // Reset modules and re-import
    vi.resetModules();
    vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));
    vi.stubGlobal('useNuxtApp', () => ({ $api: mockApi }));

    const module = await import('../../app/composables/useTenant');
    useTenant = module.useTenant;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('core functionality', () => {
    it('should call useFetch with /api/config endpoint and dedupe: defer', () => {
      useTenant();

      expect(mockUseFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockUseFetch.mock.calls[0];
      expect(url).toBe('/api/config');
      expect(options.dedupe).toBe('defer');
      expect(options.$fetch).toBeDefined();
    });

    it('should return tenant computed property', () => {
      const mockConfig = createMockTenantConfig();
      mockData.value = mockConfig;

      const { tenant } = useTenant();

      expect(tenant.value).toEqual(mockConfig);
    });

    it('should return isLoading computed property', () => {
      mockPending.value = true;

      const { isLoading } = useTenant();

      expect(isLoading.value).toBe(true);
    });

    it('should return error ref', () => {
      const error = new Error('Failed to fetch tenant config');
      mockError.value = error;

      const result = useTenant();

      expect(result.error.value).toEqual(error);
    });

    it('should return refresh function', () => {
      const { refresh } = useTenant();

      expect(refresh).toBe(mockRefresh);
    });
  });

  describe('tenantId', () => {
    it('should return tenantId from config', () => {
      mockData.value = createMockTenantConfig({ tenantId: 'my-tenant' });

      const { tenantId } = useTenant();

      expect(tenantId.value).toBe('my-tenant');
    });

    it('should return empty string when config is null', () => {
      mockData.value = null;

      const { tenantId } = useTenant();

      expect(tenantId.value).toBe('');
    });
  });

  describe('hostname', () => {
    it('should return hostname from config', () => {
      mockData.value = createMockTenantConfig({ hostname: 'shop.example.com' });

      const { hostname } = useTenant();

      expect(hostname.value).toBe('shop.example.com');
    });

    it('should return empty string when config is null', () => {
      mockData.value = null;

      const { hostname } = useTenant();

      expect(hostname.value).toBe('');
    });
  });

  describe('theme', () => {
    it('should return theme from config', () => {
      const theme = {
        name: 'custom-theme',
        colors: {
          primary: '#ff0000',
          secondary: '#00ff00',
        },
      };
      mockData.value = createMockTenantConfig({ theme });

      const result = useTenant();

      expect(result.theme.value).toEqual(theme);
    });

    it('should return undefined when config is null', () => {
      mockData.value = null;

      const { theme } = useTenant();

      expect(theme.value).toBeUndefined();
    });
  });

  describe('branding', () => {
    it('should return branding from config', () => {
      const branding = {
        name: 'My Brand',
        logoUrl: 'https://example.com/my-logo.png',
      };
      mockData.value = createMockTenantConfig({ branding });

      const result = useTenant();

      expect(result.branding.value).toEqual(branding);
    });

    it('should return undefined when config is null', () => {
      mockData.value = null;

      const { branding } = useTenant();

      expect(branding.value).toBeUndefined();
    });
  });

  describe('features', () => {
    it('should return features from config', () => {
      const features = {
        search: true,
        authentication: false,
        cart: true,
      };
      mockData.value = createMockTenantConfig({ features });

      const result = useTenant();

      expect(result.features.value).toEqual(features);
    });

    it('should return undefined when config is null', () => {
      mockData.value = null;

      const { features } = useTenant();

      expect(features.value).toBeUndefined();
    });
  });

  describe('hasFeature', () => {
    it('should return true for enabled feature', () => {
      mockData.value = createMockTenantConfig({
        features: { search: true, cart: false },
      });

      const { hasFeature } = useTenant();

      expect(hasFeature('search')).toBe(true);
    });

    it('should return false for disabled feature', () => {
      mockData.value = createMockTenantConfig({
        features: { search: true, cart: false },
      });

      const { hasFeature } = useTenant();

      expect(hasFeature('cart')).toBe(false);
    });

    it('should return false for undefined feature', () => {
      mockData.value = createMockTenantConfig({
        features: { search: true },
      });

      const { hasFeature } = useTenant();

      expect(hasFeature('wishlist')).toBe(false);
    });

    it('should return false when config is null', () => {
      mockData.value = null;

      const { hasFeature } = useTenant();

      expect(hasFeature('search')).toBe(false);
    });

    it('should return false when features is undefined', () => {
      mockData.value = createMockTenantConfig({ features: undefined });

      const { hasFeature } = useTenant();

      expect(hasFeature('search')).toBe(false);
    });
  });

  describe('logoUrl', () => {
    it('should return logoUrl from branding', () => {
      mockData.value = createMockTenantConfig({
        branding: { name: 'Brand', logoUrl: 'https://example.com/logo.png' },
      });

      const { logoUrl } = useTenant();

      expect(logoUrl.value).toBe('https://example.com/logo.png');
    });

    it('should return fallback /logo.svg when logoUrl is not set', () => {
      mockData.value = createMockTenantConfig({
        branding: { name: 'Brand' },
      });

      const { logoUrl } = useTenant();

      expect(logoUrl.value).toBe('/logo.svg');
    });

    it('should return fallback /logo.svg when branding is undefined', () => {
      mockData.value = createMockTenantConfig({ branding: undefined });

      const { logoUrl } = useTenant();

      expect(logoUrl.value).toBe('/logo.svg');
    });

    it('should return fallback /logo.svg when config is null', () => {
      mockData.value = null;

      const { logoUrl } = useTenant();

      expect(logoUrl.value).toBe('/logo.svg');
    });
  });

  describe('brandName', () => {
    it('should return brand name from branding', () => {
      mockData.value = createMockTenantConfig({
        branding: { name: 'My Store' },
      });

      const { brandName } = useTenant();

      expect(brandName.value).toBe('My Store');
    });

    it('should fallback to tenantId when branding name is not set', () => {
      mockData.value = createMockTenantConfig({
        tenantId: 'fallback-tenant',
        branding: undefined,
      });

      const { brandName } = useTenant();

      expect(brandName.value).toBe('fallback-tenant');
    });

    it('should fallback to "Store" when both branding and tenantId are unavailable', () => {
      mockData.value = null;

      const { brandName } = useTenant();

      expect(brandName.value).toBe('Store');
    });
  });

  describe('reactivity', () => {
    it('should update tenant when data changes', () => {
      const { tenant } = useTenant();

      expect(tenant.value).toBeNull();

      mockData.value = createMockTenantConfig({ tenantId: 'new-tenant' });

      expect(tenant.value?.tenantId).toBe('new-tenant');
    });

    it('should update isLoading when pending changes', () => {
      const { isLoading } = useTenant();

      expect(isLoading.value).toBe(false);

      mockPending.value = true;

      expect(isLoading.value).toBe(true);
    });

    it('should update computed properties when data changes', () => {
      const { tenantId, brandName, logoUrl } = useTenant();

      expect(tenantId.value).toBe('');
      expect(brandName.value).toBe('Store');
      expect(logoUrl.value).toBe('/logo.svg');

      mockData.value = createMockTenantConfig({
        tenantId: 'reactive-tenant',
        branding: {
          name: 'Reactive Brand',
          logoUrl: 'https://example.com/reactive-logo.png',
        },
      });

      expect(tenantId.value).toBe('reactive-tenant');
      expect(brandName.value).toBe('Reactive Brand');
      expect(logoUrl.value).toBe('https://example.com/reactive-logo.png');
    });
  });
});

describe('useTenantTheme', () => {
  let useTenantTheme: typeof import('../../app/composables/useTenant').useTenantTheme;

  beforeEach(async () => {
    // Reset mocks
    mockData.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockRefresh.mockClear();
    mockUseFetch.mockClear();

    // Reset modules and re-import
    vi.resetModules();
    vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));
    vi.stubGlobal('useNuxtApp', () => ({ $api: mockApi }));

    const module = await import('../../app/composables/useTenant');
    useTenantTheme = module.useTenantTheme;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('core functionality', () => {
    it('should return colors computed property', () => {
      mockData.value = createMockTenantConfig({
        theme: {
          name: 'test',
          colors: {
            primary: '#ff0000',
            secondary: '#00ff00',
          },
        },
      });

      const { colors } = useTenantTheme();

      expect(colors.value).toEqual({
        primary: '#ff0000',
        secondary: '#00ff00',
      });
    });

    it('should return typography computed property', () => {
      mockData.value = createMockTenantConfig({
        theme: {
          name: 'test',
          colors: { primary: '#000', secondary: '#fff' },
          typography: {
            fontFamily: 'Inter, sans-serif',
            baseFontSize: '16px',
          },
        },
      });

      const { typography } = useTenantTheme();

      expect(typography.value).toEqual({
        fontFamily: 'Inter, sans-serif',
        baseFontSize: '16px',
      });
    });

    it('should return borderRadius computed property', () => {
      mockData.value = createMockTenantConfig({
        theme: {
          name: 'test',
          colors: { primary: '#000', secondary: '#fff' },
          borderRadius: {
            base: '0.5rem',
            lg: '1rem',
          },
        },
      });

      const { borderRadius } = useTenantTheme();

      expect(borderRadius.value).toEqual({
        base: '0.5rem',
        lg: '1rem',
      });
    });
  });

  describe('getColor', () => {
    it('should return color value by name', () => {
      mockData.value = createMockTenantConfig({
        theme: {
          name: 'test',
          colors: {
            primary: '#ff0000',
            secondary: '#00ff00',
          },
        },
      });

      const { getColor } = useTenantTheme();

      expect(getColor('primary')).toBe('#ff0000');
      expect(getColor('secondary')).toBe('#00ff00');
    });

    it('should return fallback when color is not defined', () => {
      mockData.value = createMockTenantConfig({
        theme: {
          name: 'test',
          colors: {
            primary: '#ff0000',
            secondary: '#00ff00',
          },
        },
      });

      const { getColor } = useTenantTheme();

      expect(getColor('background', '#fallback')).toBe('#fallback');
    });

    it('should return empty string as default fallback', () => {
      mockData.value = createMockTenantConfig({
        theme: {
          name: 'test',
          colors: {
            primary: '#ff0000',
            secondary: '#00ff00',
          },
        },
      });

      const { getColor } = useTenantTheme();

      expect(getColor('background')).toBe('');
    });
  });

  describe('color computed properties', () => {
    it('should return primaryColor with default fallback', () => {
      mockData.value = null;

      const { primaryColor } = useTenantTheme();

      expect(primaryColor.value).toBe('#000000');
    });

    it('should return primaryColor from theme', () => {
      mockData.value = createMockTenantConfig({
        theme: {
          name: 'test',
          colors: {
            primary: '#3b82f6',
            secondary: '#fff',
          },
        },
      });

      const { primaryColor } = useTenantTheme();

      expect(primaryColor.value).toBe('#3b82f6');
    });

    it('should return secondaryColor with default fallback', () => {
      mockData.value = null;

      const { secondaryColor } = useTenantTheme();

      expect(secondaryColor.value).toBe('#ffffff');
    });

    it('should return secondaryColor from theme', () => {
      mockData.value = createMockTenantConfig({
        theme: {
          name: 'test',
          colors: {
            primary: '#000',
            secondary: '#64748b',
          },
        },
      });

      const { secondaryColor } = useTenantTheme();

      expect(secondaryColor.value).toBe('#64748b');
    });

    it('should return backgroundColor with default fallback', () => {
      mockData.value = null;

      const { backgroundColor } = useTenantTheme();

      expect(backgroundColor.value).toBe('oklch(1 0 0)');
    });

    it('should return backgroundColor from theme', () => {
      mockData.value = createMockTenantConfig({
        theme: {
          name: 'test',
          colors: {
            primary: '#000',
            secondary: '#fff',
            background: '#f8f8f8',
          },
        },
      });

      const { backgroundColor } = useTenantTheme();

      expect(backgroundColor.value).toBe('#f8f8f8');
    });

    it('should return foregroundColor with default fallback', () => {
      mockData.value = null;

      const { foregroundColor } = useTenantTheme();

      expect(foregroundColor.value).toBe('oklch(0.145 0 0)');
    });

    it('should return foregroundColor from theme', () => {
      mockData.value = createMockTenantConfig({
        theme: {
          name: 'test',
          colors: {
            primary: '#000',
            secondary: '#fff',
            foreground: '#1a1a1a',
          },
        },
      });

      const { foregroundColor } = useTenantTheme();

      expect(foregroundColor.value).toBe('#1a1a1a');
    });
  });

  describe('undefined values', () => {
    it('should handle undefined colors gracefully', () => {
      mockData.value = null;

      const { colors, typography, borderRadius } = useTenantTheme();

      expect(colors.value).toBeUndefined();
      expect(typography.value).toBeUndefined();
      expect(borderRadius.value).toBeUndefined();
    });
  });
});
