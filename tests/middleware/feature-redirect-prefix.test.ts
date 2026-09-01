import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';

// Exercises the REAL middleware module. feature.test.ts re-implements the
// middleware inline and hardcodes its redirect target, so it cannot see the
// prefix the actual module builds.
import featureMiddleware from '../../app/middleware/feature';

let mockLocaleCookie: string | null = 'en';
let mockMarketCookie: string | null = 'se';
let mockTenantLocale: string | undefined;
let mockTenantMarket: string | undefined;
let mockCanAccess = false;

vi.mock('~/composables/useTenant', () => ({
  useTenant: () => ({
    tenant: computed(() =>
      mockTenantLocale || mockTenantMarket
        ? { locale: mockTenantLocale, market: mockTenantMarket }
        : { locale: undefined, market: undefined },
    ),
    suspense: () => Promise.resolve(),
  }),
}));

vi.mock('~/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: () => mockCanAccess }),
}));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    isInitialized: true,
    fetchUser: vi.fn(),
  }),
}));

vi.mock('~/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockNavigateTo = vi.fn(
  (path: string, opts?: Record<string, unknown>) => ({ path, opts }),
);

vi.mock('#app/composables/router', () => ({
  navigateTo: (path: string, opts?: Record<string, unknown>) =>
    mockNavigateTo(path, opts),
  defineNuxtRouteMiddleware: (fn: (to: RouteLocationNormalized) => unknown) =>
    fn,
}));

vi.mock('#app/composables/cookie', () => ({
  useCookie: (name: string) => ({
    value:
      name === 'market'
        ? mockMarketCookie
        : name === 'locale'
          ? mockLocaleCookie
          : null,
  }),
}));

function createRoute(
  overrides: Partial<RouteLocationNormalized> = {},
): RouteLocationNormalized {
  return {
    path: '/portal/favorites',
    name: 'favorites',
    params: {},
    query: {},
    hash: '',
    fullPath: '/portal/favorites',
    matched: [],
    redirectedFrom: undefined,
    meta: { feature: 'wishlist' },
    ...overrides,
  };
}

// The middleware is typed as Nuxt's RouteMiddleware, which takes (to, from).
// Only `to` is read, so `from` mirrors it.
const run = (to: RouteLocationNormalized) => featureMiddleware(to, to);

describe('feature middleware redirect prefix', () => {
  beforeEach(() => {
    mockLocaleCookie = 'en';
    mockMarketCookie = 'se';
    mockTenantLocale = undefined;
    mockTenantMarket = undefined;
    mockCanAccess = false;
    mockNavigateTo.mockClear();
  });

  it('passes the route through when the feature is accessible', async () => {
    mockCanAccess = true;
    const result = await run(createRoute());
    expect(result).toBeUndefined();
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it('does nothing when the route declares no feature', async () => {
    const result = await run(createRoute({ meta: {} }));
    expect(result).toBeUndefined();
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it('takes the locale from the URL, not the cookie, when they disagree', async () => {
    mockLocaleCookie = 'sv';
    await run(
      createRoute({
        path: '/se/nb/portal/favorites',
        fullPath: '/se/nb/portal/favorites',
        params: { market: 'se', locale: 'nb' },
      }),
    );
    expect(mockNavigateTo).toHaveBeenCalledWith('/se/nb/', { replace: true });
  });

  it('keeps the URL language on a cookieless deep link', async () => {
    mockLocaleCookie = null;
    mockMarketCookie = null;
    await run(
      createRoute({
        path: '/se/nb/portal/favorites',
        fullPath: '/se/nb/portal/favorites',
        params: { market: 'se', locale: 'nb' },
      }),
    );
    expect(mockNavigateTo).toHaveBeenCalledWith('/se/nb/', { replace: true });
  });

  it('recovers the pair from the path when the route carries no params', async () => {
    mockLocaleCookie = null;
    mockMarketCookie = null;
    await run(
      createRoute({
        path: '/fi/da/portal/favorites',
        fullPath: '/fi/da/portal/favorites',
      }),
    );
    expect(mockNavigateTo).toHaveBeenCalledWith('/fi/da/', { replace: true });
  });

  it('falls back to cookies, then config, then the se/sv pair', async () => {
    await run(createRoute());
    expect(mockNavigateTo).toHaveBeenCalledWith('/se/en/', { replace: true });

    mockNavigateTo.mockClear();
    mockLocaleCookie = null;
    mockMarketCookie = null;
    mockTenantLocale = 'da-DK';
    mockTenantMarket = 'dk';
    await run(createRoute());
    expect(mockNavigateTo).toHaveBeenCalledWith('/dk/da/', { replace: true });

    mockNavigateTo.mockClear();
    mockTenantLocale = undefined;
    mockTenantMarket = undefined;
    await run(createRoute());
    expect(mockNavigateTo).toHaveBeenCalledWith('/se/sv/', { replace: true });
  });
});
