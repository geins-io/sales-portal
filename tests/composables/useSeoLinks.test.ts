import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

// Mock state
const mockLocaleRef = ref('sv');
const mockMarketCookieValue = ref<string | null>('se');
const mockTenantMarket = ref('se');
const mockAvailableLocales = ref<string[]>(['sv', 'en']);
const mockAvailableMarkets = ref<string[]>(['se']);

const mockHeadCalls: unknown[] = [];

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: mockLocaleRef,
  }),
}));

// Mock useTenant
vi.mock('~/composables/useTenant', () => ({
  useTenant: () => ({
    market: computed(() => mockTenantMarket.value),
    availableLocales: computed(() => mockAvailableLocales.value),
    availableMarkets: computed(() => mockAvailableMarkets.value),
  }),
}));

// Mock Nuxt router composables
vi.mock('#app/composables/router', () => ({
  useRoute: () => ({ fullPath: '/se/sv/' }),
  navigateTo: vi.fn(),
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

// Mock Nuxt head composables (useHead auto-imports from #app/composables/head)
vi.mock('#app/composables/head', () => ({
  useHead: (arg: unknown) => mockHeadCalls.push(arg),
  useHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));

// Stub Nuxt auto-imports
vi.stubGlobal('computed', computed);
vi.stubGlobal('ref', ref);
vi.stubGlobal('toValue', (v: unknown) => {
  if (v && typeof v === 'object' && 'value' in v)
    return (v as { value: unknown }).value;
  if (typeof v === 'function') return (v as () => unknown)();
  return v;
});
vi.stubGlobal('useRoute', () => ({ fullPath: '/se/sv/' }));
vi.stubGlobal('useCookie', () => mockMarketCookieValue);
vi.stubGlobal('useHead', (arg: unknown) => mockHeadCalls.push(arg));

// Import after mocks
const { useSeoLinks } = await import('~/composables/useSeoLinks');

describe('useSeoLinks', () => {
  beforeEach(() => {
    mockLocaleRef.value = 'sv';
    mockMarketCookieValue.value = 'se';
    mockTenantMarket.value = 'se';
    mockAvailableLocales.value = ['sv', 'en'];
    mockHeadCalls.length = 0;
  });

  it('generates a canonical link for the current market/locale', () => {
    const { seoLinks } = useSeoLinks('/p/my-product');
    const canonical = seoLinks.value.find((l) => l.rel === 'canonical');
    expect(canonical).toEqual({
      rel: 'canonical',
      href: '/se/sv/p/my-product',
    });
  });

  it('generates hreflang alternates for all valid locales', () => {
    const { seoLinks } = useSeoLinks('/p/my-product');
    const alternates = seoLinks.value.filter(
      (l) => l.rel === 'alternate' && l.hreflang !== 'x-default',
    );
    expect(alternates).toEqual([
      { rel: 'alternate', href: '/se/sv/p/my-product', hreflang: 'sv-SE' },
      { rel: 'alternate', href: '/se/en/p/my-product', hreflang: 'en-SE' },
    ]);
  });

  it('generates x-default pointing to en locale when available', () => {
    const { seoLinks } = useSeoLinks('/p/my-product');
    const xDefault = seoLinks.value.find((l) => l.hreflang === 'x-default');
    expect(xDefault).toEqual({
      rel: 'alternate',
      href: '/se/en/p/my-product',
      hreflang: 'x-default',
    });
  });

  it('uses first locale for x-default when en is not available', () => {
    mockAvailableLocales.value = ['sv', 'da'];
    const { seoLinks } = useSeoLinks('/c/shoes');
    const xDefault = seoLinks.value.find((l) => l.hreflang === 'x-default');
    expect(xDefault?.href).toBe('/se/sv/c/shoes');
  });

  it('handles root path with trailing slash', () => {
    const { seoLinks } = useSeoLinks('/');
    const canonical = seoLinks.value.find((l) => l.rel === 'canonical');
    expect(canonical?.href).toBe('/se/sv/');
    const alternate = seoLinks.value.find((l) => l.hreflang === 'en-SE');
    expect(alternate?.href).toBe('/se/en/');
  });

  it('accepts a reactive ref as path', () => {
    const path = ref('/p/initial');
    const { seoLinks } = useSeoLinks(path);
    expect(seoLinks.value.find((l) => l.rel === 'canonical')?.href).toBe(
      '/se/sv/p/initial',
    );

    path.value = '/p/updated';
    expect(seoLinks.value.find((l) => l.rel === 'canonical')?.href).toBe(
      '/se/sv/p/updated',
    );
  });

  it('accepts a computed as path', () => {
    const alias = ref('shoes');
    const path = computed(() => `/c/${alias.value}`);
    const { seoLinks } = useSeoLinks(path);
    expect(seoLinks.value.find((l) => l.rel === 'canonical')?.href).toBe(
      '/se/sv/c/shoes',
    );

    alias.value = 'boots';
    expect(seoLinks.value.find((l) => l.rel === 'canonical')?.href).toBe(
      '/se/sv/c/boots',
    );
  });

  it('calls useHead with the link array', () => {
    useSeoLinks('/b/nike');
    expect(mockHeadCalls.length).toBeGreaterThan(0);
    const lastCall = mockHeadCalls[mockHeadCalls.length - 1] as {
      link: unknown;
    };
    expect(lastCall).toHaveProperty('link');
  });

  it('reacts to market changes', () => {
    const { seoLinks } = useSeoLinks('/p/item');
    expect(seoLinks.value.find((l) => l.rel === 'canonical')?.href).toBe(
      '/se/sv/p/item',
    );

    mockMarketCookieValue.value = 'no';
    expect(seoLinks.value.find((l) => l.rel === 'canonical')?.href).toBe(
      '/no/sv/p/item',
    );
  });
});
