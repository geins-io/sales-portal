import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';

import authMiddleware from '../../app/middleware/auth';

let mockIsAuthenticated = false;
let mockIsInitialized = true;
let mockCustomerType: string | undefined = undefined;
let mockLocaleCookie: string | null = 'en';
let mockMarketCookie: string | null = 'se';
let mockTenantLocale: string | undefined = undefined;
let mockTenantMarket: string | undefined = undefined;
const mockFetchUser = vi.fn();

vi.mock('~/composables/useTenant', () => ({
  useTenant: () => ({
    tenant: computed(() =>
      mockTenantLocale || mockTenantMarket
        ? { locale: mockTenantLocale, market: mockTenantMarket }
        : null,
    ),
  }),
}));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    get isAuthenticated() {
      return mockIsAuthenticated;
    },
    get isInitialized() {
      return mockIsInitialized;
    },
    get user() {
      return mockCustomerType ? { customerType: mockCustomerType } : null;
    },
    fetchUser: mockFetchUser,
    hasAnyRole: (roles: string[]) =>
      mockCustomerType ? roles.includes(mockCustomerType) : false,
  }),
}));

const mockNavigateTo = vi.fn((opts: { path: string }) => opts);

vi.mock('#app/composables/router', () => ({
  navigateTo: (...args: unknown[]) => mockNavigateTo(...args),
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
    path: '/portal',
    name: 'portal',
    params: {},
    query: {},
    hash: '',
    fullPath: '/portal',
    matched: [],
    redirectedFrom: undefined,
    meta: {},
    ...overrides,
  };
}

describe('auth middleware', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockIsInitialized = true;
    mockCustomerType = undefined;
    mockLocaleCookie = 'en';
    mockMarketCookie = 'se';
    mockTenantLocale = undefined;
    mockTenantMarket = undefined;
    mockFetchUser.mockReset();
    mockNavigateTo.mockClear();
  });

  it('redirects unauthenticated users to /login', async () => {
    const result = await authMiddleware(createRoute());
    expect(result).toEqual({
      path: '/se/en/login',
      query: { redirect: '/portal' },
    });
  });

  it('does not add redirect query for / path', async () => {
    const result = await authMiddleware(
      createRoute({ path: '/', fullPath: '/' }),
    );
    expect(result).toEqual({ path: '/se/en/login', query: undefined });
  });

  it('allows authenticated users through when no roles required', async () => {
    mockIsAuthenticated = true;
    mockCustomerType = 'retail';
    const result = await authMiddleware(createRoute());
    expect(result).toBeUndefined();
  });

  it('allows authenticated users with matching role', async () => {
    mockIsAuthenticated = true;
    mockCustomerType = 'wholesale';
    const result = await authMiddleware(
      createRoute({ meta: { roles: ['wholesale'] } }),
    );
    expect(result).toBeUndefined();
  });

  it('redirects authenticated users with wrong role to /', async () => {
    mockIsAuthenticated = true;
    mockCustomerType = 'retail';
    const result = await authMiddleware(
      createRoute({ meta: { roles: ['wholesale'] } }),
    );
    expect(result).toEqual({ path: '/se/en/' });
  });

  it('redirects authenticated users with no customerType when roles required', async () => {
    mockIsAuthenticated = true;
    mockCustomerType = undefined;
    const result = await authMiddleware(
      createRoute({ meta: { roles: ['wholesale'] } }),
    );
    expect(result).toEqual({ path: '/se/en/' });
  });

  it('falls back to the tenant config default locale when the cookie is absent', async () => {
    mockLocaleCookie = null;
    mockTenantLocale = 'nb-NO';
    const result = await authMiddleware(createRoute());
    expect(result).toEqual({
      path: '/se/nb/login',
      query: { redirect: '/portal' },
    });
  });

  it('falls back to "sv" when both the cookie and the config default are absent', async () => {
    mockLocaleCookie = null;
    mockTenantLocale = undefined;
    const result = await authMiddleware(createRoute());
    expect(result).toEqual({
      path: '/se/sv/login',
      query: { redirect: '/portal' },
    });
  });

  it('falls back to the tenant config default market when the cookie is absent', async () => {
    mockMarketCookie = null;
    mockTenantMarket = 'dk';
    const result = await authMiddleware(createRoute());
    expect(result).toEqual({
      path: '/dk/en/login',
      query: { redirect: '/portal' },
    });
  });

  it('falls back to "se" when both the market cookie and the config default are absent', async () => {
    mockMarketCookie = null;
    mockTenantMarket = undefined;
    const result = await authMiddleware(createRoute());
    expect(result).toEqual({
      path: '/se/en/login',
      query: { redirect: '/portal' },
    });
  });

  it('prefers the market cookie over the tenant config default market', async () => {
    mockMarketCookie = 'no';
    mockTenantMarket = 'dk';
    const result = await authMiddleware(createRoute());
    expect(result).toEqual({
      path: '/no/en/login',
      query: { redirect: '/portal' },
    });
  });

  it('takes the locale from the URL, not the cookie, when they disagree', async () => {
    mockLocaleCookie = 'sv';
    mockMarketCookie = 'se';
    const result = await authMiddleware(
      createRoute({
        path: '/se/nb/portal',
        fullPath: '/se/nb/portal',
        params: { market: 'se', locale: 'nb' },
      }),
    );
    expect(result).toEqual({
      path: '/se/nb/login',
      query: { redirect: '/se/nb/portal' },
    });
  });

  it('keeps the URL language on a cookieless deep link', async () => {
    // The reported bug: cookies cannot help on a first request (useCookie
    // reads request headers, the server sets them on the response) and the
    // tenant may be unresolved, so the URL is the only source left.
    mockLocaleCookie = null;
    mockMarketCookie = null;
    mockTenantLocale = undefined;
    mockTenantMarket = undefined;
    const result = await authMiddleware(
      createRoute({
        path: '/se/nb/portal',
        fullPath: '/se/nb/portal',
        params: { market: 'se', locale: 'nb' },
      }),
    );
    expect(result).toEqual({
      path: '/se/nb/login',
      query: { redirect: '/se/nb/portal' },
    });
  });

  it('recovers the pair from the path when the route carries no params', async () => {
    mockLocaleCookie = null;
    mockMarketCookie = null;
    const result = await authMiddleware(
      createRoute({ path: '/fi/da/portal', fullPath: '/fi/da/portal' }),
    );
    expect(result).toEqual({
      path: '/fi/da/login',
      query: { redirect: '/fi/da/portal' },
    });
  });

  it('takes the URL market over both cookie and config', async () => {
    mockMarketCookie = 'no';
    mockTenantMarket = 'dk';
    const result = await authMiddleware(
      createRoute({
        path: '/fi/en/portal',
        fullPath: '/fi/en/portal',
        params: { market: 'fi', locale: 'en' },
      }),
    );
    expect(result).toEqual({
      path: '/fi/en/login',
      query: { redirect: '/fi/en/portal' },
    });
  });

  it('still falls back to cookies for an unprefixed route', async () => {
    mockLocaleCookie = 'en';
    mockMarketCookie = 'se';
    const result = await authMiddleware(createRoute());
    expect(result).toEqual({
      path: '/se/en/login',
      query: { redirect: '/portal' },
    });
  });

  it('calls fetchUser when not initialized', async () => {
    mockIsInitialized = false;
    await authMiddleware(createRoute());
    expect(mockFetchUser).toHaveBeenCalledOnce();
  });

  it('does not call fetchUser when already initialized', async () => {
    mockIsInitialized = true;
    await authMiddleware(createRoute());
    expect(mockFetchUser).not.toHaveBeenCalled();
  });
});
