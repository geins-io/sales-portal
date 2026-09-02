/**
 * `/:market/:locale` matches ANY two segments, so `/hejhej/sv/` must not reach
 * the market cookie. Covers the market guard and the shipped-locales gate.
 *
 * Nuxt tier (see vitest.workspace.ts): the middleware reaches its composables
 * through auto-imports, which only mockNuxtImport can intercept.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import type { RouteLocationNormalized } from 'vue-router';

const marketCookie = ref<string | null>(null);
const availableMarkets = ref<string[]>([]);
const i18nLocale = ref('sv');
const i18nLocales = ref<Array<{ code: string }>>([
  { code: 'en' },
  { code: 'sv' },
  { code: 'nb' },
  { code: 'fi' },
  { code: 'da' },
]);
const setLocaleMock = vi.fn((code: string) => {
  i18nLocale.value = code;
});

mockNuxtImport('useCookie', () => () => marketCookie);
mockNuxtImport('useTenant', () => () => ({
  availableMarkets: computed(() => availableMarkets.value),
}));
mockNuxtImport('useNuxtApp', () => () => ({
  $i18n: {
    locale: i18nLocale,
    locales: computed(() => i18nLocales.value),
    setLocale: setLocaleMock,
  },
}));

function route(
  path: string,
  params: Record<string, string> = {},
): RouteLocationNormalized {
  return { path, params } as unknown as RouteLocationNormalized;
}

let handler: (to: RouteLocationNormalized) => unknown;

beforeEach(async () => {
  vi.clearAllMocks();
  marketCookie.value = null;
  availableMarkets.value = ['se', 'fi'];
  i18nLocale.value = 'sv';
  i18nLocales.value = [
    { code: 'en' },
    { code: 'sv' },
    { code: 'nb' },
    { code: 'fi' },
    { code: 'da' },
  ];
  const mod = await import('../../app/middleware/locale-market.global');
  handler = mod.default as (to: RouteLocationNormalized) => unknown;
});

describe('locale-market.global market validation', () => {
  it('writes the market cookie for a market the tenant sells', () => {
    handler(route('/fi/sv/', { market: 'fi', locale: 'sv' }));
    expect(marketCookie.value).toBe('fi');
  });

  it('does not write the market cookie for a non-two-letter route param', () => {
    handler(route('/hejhej/sv/', { market: 'hejhej', locale: 'sv' }));
    expect(marketCookie.value).toBeNull();
  });

  it('does not write the market cookie for a market the tenant does not sell', () => {
    handler(route('/xx/sv/', { market: 'xx', locale: 'sv' }));
    expect(marketCookie.value).toBeNull();
  });

  it('falls back to the shape check before the tenant config has loaded', () => {
    availableMarkets.value = [];
    handler(route('/xx/sv/', { market: 'xx', locale: 'sv' }));
    expect(marketCookie.value).toBe('xx');

    marketCookie.value = null;
    handler(route('/hejhej/sv/', { market: 'hejhej', locale: 'sv' }));
    expect(marketCookie.value).toBeNull();
  });
});

describe('locale-market.global locale validation', () => {
  it('switches to a locale the app ships and the route carries', () => {
    handler(route('/se/nb/', { market: 'se', locale: 'nb' }));
    expect(setLocaleMock).toHaveBeenCalledWith('nb');
  });

  it('does not switch to a locale the app ships no messages for', () => {
    i18nLocales.value = [...i18nLocales.value, { code: 'xx' }];
    handler(route('/se/xx/', { market: 'se', locale: 'xx' }));
    expect(setLocaleMock).not.toHaveBeenCalled();
  });

  it('ignores a route with no locale/market prefix at all', () => {
    handler(route('/about-us', {}));
    expect(marketCookie.value).toBeNull();
    expect(setLocaleMock).not.toHaveBeenCalled();
  });
});
