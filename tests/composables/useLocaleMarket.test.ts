import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

// Mock dependencies
const mockSetLocale = vi.fn();
const mockNavigateTo = vi.fn();
const mockMarketCookieValue = ref<string | null>('se');
const mockLocaleRef = ref('sv');
const mockRouteFullPath = ref('/se/sv/foder');
const mockTenantMarket = ref('se');
const mockAvailableLocales = ref<string[]>(['sv', 'en']);
const mockAvailableMarkets = ref<string[]>(['se', 'no', 'dk']);

// Mock vue-i18n (Nuxt auto-imports useI18n from here)
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: mockLocaleRef,
    setLocale: mockSetLocale,
  }),
}));

// Mock useTenant composable
vi.mock('~/composables/useTenant', () => ({
  useTenant: () => ({
    market: computed(() => mockTenantMarket.value),
    availableLocales: computed(() => mockAvailableLocales.value),
    availableMarkets: computed(() => mockAvailableMarkets.value),
  }),
}));

// Mock Nuxt router composables
vi.mock('#app/composables/router', () => ({
  useRoute: () => ({
    fullPath: mockRouteFullPath.value,
  }),
  navigateTo: (...args: unknown[]) => mockNavigateTo(...args),
  abortNavigation: vi.fn(),
  addRouteMiddleware: vi.fn(),
  defineNuxtRouteMiddleware: vi.fn(),
  setPageLayout: vi.fn(),
  useRouter: vi.fn(),
}));

// Mock Nuxt cookie composable
vi.mock('#app/composables/cookie', () => ({
  useCookie: () => mockMarketCookieValue,
}));

vi.mock('#shared/constants/storage', () => ({
  COOKIE_NAMES: {
    MARKET: 'market',
    LOCALE: 'locale',
  },
}));

// Stub Nuxt auto-imports as globals
vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('computed', computed);
vi.stubGlobal('useRoute', () => ({
  fullPath: mockRouteFullPath.value,
}));
vi.stubGlobal('useCookie', () => mockMarketCookieValue);
vi.stubGlobal('useI18n', () => ({
  locale: mockLocaleRef,
  setLocale: mockSetLocale,
}));
vi.stubGlobal('useTenant', () => ({
  market: computed(() => mockTenantMarket.value),
  availableLocales: computed(() => mockAvailableLocales.value),
  availableMarkets: computed(() => mockAvailableMarkets.value),
}));

describe('useLocaleMarket', () => {
  let useLocaleMarket: typeof import('../../app/composables/useLocaleMarket').useLocaleMarket;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset refs
    mockMarketCookieValue.value = 'se';
    mockLocaleRef.value = 'sv';
    mockRouteFullPath.value = '/se/sv/foder';
    mockTenantMarket.value = 'se';
    mockAvailableLocales.value = ['sv', 'en'];
    mockAvailableMarkets.value = ['se', 'no', 'dk'];

    // Re-stub globals after resetModules
    vi.stubGlobal('navigateTo', mockNavigateTo);
    vi.stubGlobal('computed', computed);
    vi.stubGlobal('useRoute', () => ({
      fullPath: mockRouteFullPath.value,
    }));
    vi.stubGlobal('useCookie', () => mockMarketCookieValue);
    vi.stubGlobal('useI18n', () => ({
      locale: mockLocaleRef,
      setLocale: mockSetLocale,
    }));
    vi.stubGlobal('useTenant', () => ({
      market: computed(() => mockTenantMarket.value),
      availableLocales: computed(() => mockAvailableLocales.value),
      availableMarkets: computed(() => mockAvailableMarkets.value),
    }));

    const mod = await import('../../app/composables/useLocaleMarket');
    useLocaleMarket = mod.useLocaleMarket;
  });

  describe('localePath', () => {
    it('should prefix path with /{market}/{locale}', () => {
      const { localePath } = useLocaleMarket();
      expect(localePath('/foder')).toBe('/se/sv/foder');
    });

    it('should handle root path with trailing slash', () => {
      const { localePath } = useLocaleMarket();
      expect(localePath('/')).toBe('/se/sv/');
    });

    it('should handle nested paths', () => {
      const { localePath } = useLocaleMarket();
      expect(localePath('/p/category/product')).toBe(
        '/se/sv/p/category/product',
      );
    });

    it('should add leading slash if missing', () => {
      const { localePath } = useLocaleMarket();
      expect(localePath('contact')).toBe('/se/sv/contact');
    });
  });

  describe('getCleanPath', () => {
    it('should strip market/locale prefix from current path', () => {
      const { getCleanPath } = useLocaleMarket();
      expect(getCleanPath()).toBe('/foder');
    });

    it('should return / when path is just market/locale', () => {
      mockRouteFullPath.value = '/se/sv';
      const { getCleanPath } = useLocaleMarket();
      expect(getCleanPath()).toBe('/');
    });

    it('should return full path when no prefix present', () => {
      mockRouteFullPath.value = '/contact';
      const { getCleanPath } = useLocaleMarket();
      expect(getCleanPath()).toBe('/contact');
    });

    it('should handle deeply nested paths', () => {
      mockRouteFullPath.value = '/no/en/p/category/product-name';
      const { getCleanPath } = useLocaleMarket();
      expect(getCleanPath()).toBe('/p/category/product-name');
    });

    it('should not strip prefix when second segment is not a valid locale', () => {
      mockRouteFullPath.value = '/se/xx/some-page';
      const { getCleanPath } = useLocaleMarket();
      expect(getCleanPath()).toBe('/se/xx/some-page');
    });

    it('should not strip prefix when first segment is not a valid market', () => {
      // 'xx' matches /^[a-z]{2}$/ but is not in validMarkets (['se', 'no', 'dk'])
      mockRouteFullPath.value = '/xx/sv/some-page';
      const { getCleanPath } = useLocaleMarket();
      expect(getCleanPath()).toBe('/xx/sv/some-page');
    });

    it('should strip prefix and preserve query string', () => {
      mockRouteFullPath.value = '/se/sv/search?q=boots&color=red';
      const { getCleanPath } = useLocaleMarket();
      expect(getCleanPath()).toBe('/search?q=boots&color=red');
    });

    it('should fall back to regex-only check when validMarkets Set is empty (race condition)', () => {
      // Simulate tenant config not yet loaded — both Sets are empty
      mockAvailableLocales.value = [];
      mockAvailableMarkets.value = [];
      // With regex-only fallback, /^[a-z]{2}$/ matches 'se' and 'sv', so prefix is stripped
      mockRouteFullPath.value = '/se/sv/foder';
      const { getCleanPath } = useLocaleMarket();
      expect(getCleanPath()).toBe('/foder');
    });

    it('should handle query-string-only path when no prefix present', () => {
      mockRouteFullPath.value = '/contact?ref=nav';
      const { getCleanPath } = useLocaleMarket();
      expect(getCleanPath()).toBe('/contact?ref=nav');
    });
  });

  describe('currentMarket', () => {
    it('should return market from cookie', () => {
      mockMarketCookieValue.value = 'no';
      const { currentMarket } = useLocaleMarket();
      expect(currentMarket.value).toBe('no');
    });

    it('should fall back to tenant market when no cookie', () => {
      mockMarketCookieValue.value = null;
      const { currentMarket } = useLocaleMarket();
      expect(currentMarket.value).toBe('se');
    });

    it('should fall back to "se" when both cookie and tenant empty', () => {
      mockMarketCookieValue.value = null;
      mockTenantMarket.value = '';
      const { currentMarket } = useLocaleMarket();
      expect(currentMarket.value).toBe('se');
    });
  });

  describe('currentLocale', () => {
    it('should return locale from i18n', () => {
      const { currentLocale } = useLocaleMarket();
      expect(currentLocale.value).toBe('sv');
    });

    it('should reflect i18n locale changes', () => {
      const { currentLocale } = useLocaleMarket();
      mockLocaleRef.value = 'en';
      expect(currentLocale.value).toBe('en');
    });
  });

  describe('switchLocale', () => {
    it('should navigate to home on dynamic route (locale-specific slugs)', async () => {
      const { switchLocale } = useLocaleMarket();
      await switchLocale('en');

      expect(mockSetLocale).toHaveBeenCalledWith('en');
      // Dynamic route slugs are locale-specific, so switch goes to home
      expect(mockNavigateTo).toHaveBeenCalledWith('/se/en/', {
        external: true,
      });
    });

    it('should not switch to a locale not in tenant available locales', async () => {
      const { switchLocale } = useLocaleMarket();
      await switchLocale('xx');

      expect(mockSetLocale).not.toHaveBeenCalled();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should not switch to a locale removed from tenant config', async () => {
      mockAvailableLocales.value = ['sv'];
      const { switchLocale } = useLocaleMarket();
      await switchLocale('en');

      expect(mockSetLocale).not.toHaveBeenCalled();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should handle switching from root path', async () => {
      mockRouteFullPath.value = '/se/sv';
      const { switchLocale } = useLocaleMarket();
      await switchLocale('en');

      expect(mockNavigateTo).toHaveBeenCalledWith('/se/en/', {
        external: true,
      });
    });
  });

  describe('switchMarket', () => {
    it('should navigate to home on dynamic route when switching market', async () => {
      const { switchMarket } = useLocaleMarket();
      await switchMarket('no');

      expect(mockMarketCookieValue.value).toBe('no');
      // Dynamic route slugs differ between markets, so switch goes to home
      expect(mockNavigateTo).toHaveBeenCalledWith('/no/sv/', {
        external: true,
      });
    });

    it('should not switch to a market not in tenant available markets', async () => {
      const { switchMarket } = useLocaleMarket();
      await switchMarket('fi');

      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should not switch to an invalid market code', async () => {
      const { switchMarket } = useLocaleMarket();
      await switchMarket('invalid');

      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should handle switching from root path', async () => {
      mockRouteFullPath.value = '/se/sv';
      const { switchMarket } = useLocaleMarket();
      await switchMarket('dk');

      expect(mockNavigateTo).toHaveBeenCalledWith('/dk/sv/', {
        external: true,
      });
    });

    it('should allow switching to any tenant-configured market', async () => {
      const { switchMarket } = useLocaleMarket();
      await switchMarket('dk');

      expect(mockMarketCookieValue.value).toBe('dk');
      expect(mockNavigateTo).toHaveBeenCalledWith('/dk/sv/', {
        external: true,
      });
    });
  });

  describe('validLocales and validMarkets', () => {
    it('should expose valid locales from tenant config', () => {
      const { validLocales } = useLocaleMarket();
      expect(validLocales.value).toEqual(new Set(['sv', 'en']));
    });

    it('should expose valid markets from tenant config', () => {
      const { validMarkets } = useLocaleMarket();
      expect(validMarkets.value).toEqual(new Set(['se', 'no', 'dk']));
    });

    it('should fall back to defaults when tenant has empty locales', () => {
      mockAvailableLocales.value = [];
      const { validLocales } = useLocaleMarket();
      expect(validLocales.value).toEqual(new Set(['en', 'sv']));
    });

    it('should fall back to defaults when tenant has empty markets', () => {
      mockAvailableMarkets.value = [];
      const { validMarkets } = useLocaleMarket();
      expect(validMarkets.value).toEqual(new Set(['se']));
    });
  });
});
