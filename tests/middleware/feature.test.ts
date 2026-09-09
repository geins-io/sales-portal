import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import type {
  PublicTenantConfig,
  FeatureAccess,
} from '#shared/types/tenant-config';
import type { RouteLocationNormalized } from 'vue-router';

// Exercises the REAL middleware module, and with it the real
// `useFeatureAccess` composable and the real `canAccessFeature` evaluator:
// only `useTenant`, the auth store, the cookies and `navigateTo` are mocked.
// A config fixture therefore reaches the redirect decision through the code
// the app runs, which is what lets the coverage map hang `drives: 'field'`
// references on this file.
//
// The cost is deliberate: real code from two modules runs here, so a red test
// does not name one of them on its own. Both keep their own isolating specs
// (tests/composables/useFeatureAccess.test.ts, tests/shared/feature-access.test.ts),
// so red here with those two green points at the middleware.
import featureMiddleware from '../../app/middleware/feature';

const mockTenantData = ref<PublicTenantConfig | null>(null);

/**
 * One shared mutable object, and it has to be exactly one: the middleware
 * awaits `fetchUser()` and the composable reads `isAuthenticated` off its own
 * `useAuthStore()` call a line later. Two objects would hide the flip, and the
 * readiness guard could not be asserted at all.
 *
 * Being shared, it leaks between tests unless every field is reset in
 * `beforeEach` — see below.
 */
const mockAuthStore = {
  isInitialized: true,
  isAuthenticated: false,
  fetchUser: vi.fn(),
};

let mockMarketCookie: string | null = null;
let mockLocaleCookie: string | null = null;

// Held open so a test can assert the middleware waits before deciding.
let suspenseResolve: () => void;
let suspensePromise: Promise<void>;

const resetSuspensePromise = () => {
  suspensePromise = new Promise<void>((resolve) => {
    suspenseResolve = () => resolve();
  });
};

resetSuspensePromise();

// `features` is required, not optional decoration: the real composable
// destructures it off `useTenant()`.
const mockUseTenant = vi.fn(() => ({
  tenant: computed(() => mockTenantData.value),
  features: computed(() => mockTenantData.value?.features),
  suspense: () => suspensePromise,
}));

vi.mock('~/composables/useTenant', () => ({
  useTenant: () => mockUseTenant(),
}));

// `~/composables/useFeatureAccess` is deliberately NOT mocked.

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}));

vi.mock('~/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockNavigateTo = vi.fn(
  (path: string, options?: Record<string, unknown>) => ({ path, options }),
);

vi.mock('#app/composables/router', () => ({
  navigateTo: (path: string, options?: Record<string, unknown>) =>
    mockNavigateTo(path, options),
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

/**
 * Where the middleware sends a denied visitor under this file's defaults: no
 * cookies, an unprefixed route path and no locale or market in the config, so
 * `resolveLocalePrefix` reaches its 'se'/'sv' last resort. The prefix block
 * below drives the earlier sources.
 */
const HOME = '/se/sv/';

function createMockTenantConfig(
  overrides: Partial<PublicTenantConfig> = {},
): PublicTenantConfig {
  // Object.assign rather than a spread: spreading a Partial widens every key
  // to `| undefined`, which the required fields of PublicTenantConfig reject.
  const base: PublicTenantConfig = {
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
    // The five keys the pages actually declare, all open by default.
    features: {
      orderPlacement: { enabled: true },
      lists: { enabled: true },
      wishlist: { enabled: true },
      quotes: { enabled: true },
      orderHistory: { enabled: true },
    },
    css: '',
    isActive: true,
    availableLocales: [],
    availableMarkets: [],
    imageBaseUrl: '',
    checkoutMode: 'custom',
  };
  return Object.assign(base, overrides);
}

function createRoute(
  overrides: Partial<RouteLocationNormalized> = {},
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
    meta: {},
    ...overrides,
  };
}

/** A route declaring `feature` in its meta, or none when called with nothing. */
const routeFor = (feature?: string): RouteLocationNormalized =>
  createRoute({ meta: feature === undefined ? {} : { feature } });

// The middleware is typed as Nuxt's RouteMiddleware, which takes (to, from).
// Only `to` is read, so `from` mirrors it.
const run = (to: RouteLocationNormalized) => featureMiddleware(to, to);

type FeatureRule = { enabled: boolean; access?: FeatureAccess };

/**
 * The two shapes every case in the key block takes. A helper rather than 25
 * copies of the same four lines; the assertions are still the test's own.
 */
async function expectAllowed(
  key: string,
  rule: FeatureRule,
  signedIn = false,
): Promise<void> {
  mockTenantData.value = createMockTenantConfig({ features: { [key]: rule } });
  mockAuthStore.isAuthenticated = signedIn;

  const result = await run(routeFor(key));

  expect(result).toBeUndefined();
  expect(mockNavigateTo).not.toHaveBeenCalled();
}

async function expectRedirected(
  key: string,
  rule: FeatureRule,
  signedIn = false,
): Promise<void> {
  mockTenantData.value = createMockTenantConfig({ features: { [key]: rule } });
  mockAuthStore.isAuthenticated = signedIn;

  await run(routeFor(key));

  expect(mockNavigateTo).toHaveBeenCalledWith(HOME, { replace: true });
}

describe('feature middleware', () => {
  beforeEach(() => {
    mockTenantData.value = null;
    // Every field of the shared store, every time. Anything left standing is a
    // dependency on which test ran before this one.
    mockAuthStore.isInitialized = true;
    mockAuthStore.isAuthenticated = false;
    mockAuthStore.fetchUser = vi.fn();
    mockMarketCookie = null;
    mockLocaleCookie = null;
    mockUseTenant.mockClear();
    mockNavigateTo.mockClear();
    resetSuspensePromise();
  });

  describe('when tenant data is already loaded', () => {
    beforeEach(() => {
      mockTenantData.value = createMockTenantConfig();
    });

    it('should allow access when feature is enabled', async () => {
      const result = await run(routeFor('wishlist'));

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should redirect when feature is disabled', async () => {
      mockTenantData.value = createMockTenantConfig({
        features: { orderPlacement: { enabled: false } },
      });

      await run(routeFor('orderPlacement'));

      expect(mockNavigateTo).toHaveBeenCalledWith(HOME, { replace: true });
    });

    it('should allow access when no feature is required', async () => {
      const result = await run(routeFor());

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(mockUseTenant).not.toHaveBeenCalled();
    });

    it('should redirect when feature does not exist in config', async () => {
      await run(routeFor('nonexistent'));

      expect(mockNavigateTo).toHaveBeenCalledWith(HOME, { replace: true });
    });
  });

  describe('when tenant data is not yet loaded', () => {
    it('should wait for tenant data before checking feature', async () => {
      mockTenantData.value = null;

      const middlewarePromise = run(routeFor('wishlist'));

      expect(mockNavigateTo).not.toHaveBeenCalled();

      mockTenantData.value = createMockTenantConfig();
      suspenseResolve();

      const result = await middlewarePromise;

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should redirect after loading if feature is disabled', async () => {
      mockTenantData.value = null;

      const middlewarePromise = run(routeFor('orderPlacement'));

      mockTenantData.value = createMockTenantConfig({
        features: { orderPlacement: { enabled: false } },
      });
      suspenseResolve();

      await middlewarePromise;

      expect(mockNavigateTo).toHaveBeenCalledWith(HOME, { replace: true });
    });

    it('should not wait if route has no feature requirement', async () => {
      mockTenantData.value = null;

      const result = await run(routeFor());

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(mockUseTenant).not.toHaveBeenCalled();
    });
  });

  describe('access control', () => {
    it('should redirect when feature requires auth and user is anonymous', async () => {
      mockTenantData.value = createMockTenantConfig({
        features: {
          orderPlacement: { enabled: true, access: 'authenticated' },
        },
      });

      await run(routeFor('orderPlacement'));

      expect(mockNavigateTo).toHaveBeenCalledWith(HOME, { replace: true });
    });

    it('should allow access when feature requires auth and user is logged in', async () => {
      mockAuthStore.isAuthenticated = true;
      mockTenantData.value = createMockTenantConfig({
        features: {
          orderPlacement: { enabled: true, access: 'authenticated' },
        },
      });

      const result = await run(routeFor('orderPlacement'));

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });
  });

  /**
   * The middleware resolves the auth store before deciding. An
   * `access: 'authenticated'` rule reads that store, so an unresolved one
   * makes a signed-in shopper look anonymous and redirects them off the page
   * they are entitled to. Nothing exercised the guard before this file did.
   */
  describe('auth readiness', () => {
    beforeEach(() => {
      mockTenantData.value = createMockTenantConfig({
        features: { quotes: { enabled: true, access: 'authenticated' } },
      });
    });

    it('resolves the auth store before deciding when quotes requires authentication', async () => {
      mockAuthStore.isInitialized = false;
      mockAuthStore.fetchUser = vi.fn(async () => {
        mockAuthStore.isAuthenticated = true;
        mockAuthStore.isInitialized = true;
      });

      const result = await run(routeFor('quotes'));

      expect(mockAuthStore.fetchUser).toHaveBeenCalled();
      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('redirects when the resolved store is still anonymous', async () => {
      mockAuthStore.isInitialized = false;
      mockAuthStore.fetchUser = vi.fn(async () => {
        mockAuthStore.isInitialized = true;
      });

      await run(routeFor('quotes'));

      expect(mockAuthStore.fetchUser).toHaveBeenCalled();
      expect(mockNavigateTo).toHaveBeenCalledWith(HOME, { replace: true });
    });

    it('does not refetch the user when the store is already initialised', async () => {
      mockAuthStore.isInitialized = true;
      mockAuthStore.isAuthenticated = true;

      const result = await run(routeFor('quotes'));

      expect(mockAuthStore.fetchUser).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined features object', async () => {
      mockTenantData.value = createMockTenantConfig({
        features: undefined,
      } as Partial<PublicTenantConfig>);

      await run(routeFor('wishlist'));

      expect(mockNavigateTo).toHaveBeenCalledWith(HOME, { replace: true });
    });

    it('should handle empty feature meta', async () => {
      mockTenantData.value = createMockTenantConfig();

      const result = await run(routeFor(''));

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('should handle null tenant config after loading', async () => {
      mockTenantData.value = null;

      const middlewarePromise = run(routeFor('wishlist'));
      suspenseResolve();
      await middlewarePromise;

      expect(mockNavigateTo).toHaveBeenCalledWith(HOME, { replace: true });
    });
  });

  /**
   * The five keys `definePageMeta` declares, each through the five states its
   * config cell can be in. Titles name their key because the coverage map
   * requires it, and they are written out rather than generated because
   * map.test.ts matches a referenced title as a substring of this file.
   */
  describe('the feature keys the pages declare', () => {
    describe('orderPlacement', () => {
      it('allows orderPlacement when it is enabled with no access rule', async () => {
        await expectAllowed('orderPlacement', { enabled: true });
      });

      it('redirects when orderPlacement is disabled', async () => {
        await expectRedirected('orderPlacement', { enabled: false });
      });

      it('allows orderPlacement when access is open to all', async () => {
        await expectAllowed('orderPlacement', { enabled: true, access: 'all' });
      });

      it('redirects when orderPlacement requires authentication and the user is anonymous', async () => {
        await expectRedirected('orderPlacement', {
          enabled: true,
          access: 'authenticated',
        });
      });

      it('allows orderPlacement when it requires authentication and the user is signed in', async () => {
        await expectAllowed(
          'orderPlacement',
          { enabled: true, access: 'authenticated' },
          true,
        );
      });
    });

    describe('lists', () => {
      it('allows lists when it is enabled with no access rule', async () => {
        await expectAllowed('lists', { enabled: true });
      });

      it('redirects when lists is disabled', async () => {
        await expectRedirected('lists', { enabled: false });
      });

      it('allows lists when access is open to all', async () => {
        await expectAllowed('lists', { enabled: true, access: 'all' });
      });

      it('redirects when lists requires authentication and the user is anonymous', async () => {
        await expectRedirected('lists', {
          enabled: true,
          access: 'authenticated',
        });
      });

      it('allows lists when it requires authentication and the user is signed in', async () => {
        await expectAllowed(
          'lists',
          { enabled: true, access: 'authenticated' },
          true,
        );
      });
    });

    describe('wishlist', () => {
      it('allows wishlist when it is enabled with no access rule', async () => {
        await expectAllowed('wishlist', { enabled: true });
      });

      it('redirects when wishlist is disabled', async () => {
        await expectRedirected('wishlist', { enabled: false });
      });

      it('allows wishlist when access is open to all', async () => {
        await expectAllowed('wishlist', { enabled: true, access: 'all' });
      });

      it('redirects when wishlist requires authentication and the user is anonymous', async () => {
        await expectRedirected('wishlist', {
          enabled: true,
          access: 'authenticated',
        });
      });

      it('allows wishlist when it requires authentication and the user is signed in', async () => {
        await expectAllowed(
          'wishlist',
          { enabled: true, access: 'authenticated' },
          true,
        );
      });
    });

    describe('quotes', () => {
      it('allows quotes when it is enabled with no access rule', async () => {
        await expectAllowed('quotes', { enabled: true });
      });

      it('redirects when quotes is disabled', async () => {
        await expectRedirected('quotes', { enabled: false });
      });

      it('allows quotes when access is open to all', async () => {
        await expectAllowed('quotes', { enabled: true, access: 'all' });
      });

      it('redirects when quotes requires authentication and the user is anonymous', async () => {
        await expectRedirected('quotes', {
          enabled: true,
          access: 'authenticated',
        });
      });

      it('allows quotes when it requires authentication and the user is signed in', async () => {
        await expectAllowed(
          'quotes',
          { enabled: true, access: 'authenticated' },
          true,
        );
      });
    });

    describe('orderHistory', () => {
      it('allows orderHistory when it is enabled with no access rule', async () => {
        await expectAllowed('orderHistory', { enabled: true });
      });

      it('redirects when orderHistory is disabled', async () => {
        await expectRedirected('orderHistory', { enabled: false });
      });

      it('allows orderHistory when access is open to all', async () => {
        await expectAllowed('orderHistory', { enabled: true, access: 'all' });
      });

      it('redirects when orderHistory requires authentication and the user is anonymous', async () => {
        await expectRedirected('orderHistory', {
          enabled: true,
          access: 'authenticated',
        });
      });

      it('allows orderHistory when it requires authentication and the user is signed in', async () => {
        await expectAllowed(
          'orderHistory',
          { enabled: true, access: 'authenticated' },
          true,
        );
      });
    });
  });

  /**
   * Where a denied visitor is sent. Moved here from
   * tests/middleware/feature-redirect-prefix.test.ts, which existed only
   * because this file used to re-implement the middleware and hardcode '/'.
   */
  describe('redirect prefix', () => {
    beforeEach(() => {
      mockLocaleCookie = 'en';
      mockMarketCookie = 'se';
      mockTenantData.value = createMockTenantConfig({
        features: { wishlist: { enabled: false } },
      });
    });

    const favorites = (
      overrides: Partial<RouteLocationNormalized> = {},
    ): RouteLocationNormalized =>
      createRoute({
        path: '/portal/favorites',
        name: 'favorites',
        fullPath: '/portal/favorites',
        meta: { feature: 'wishlist' },
        ...overrides,
      });

    it('passes the route through when the feature is accessible', async () => {
      mockTenantData.value = createMockTenantConfig();

      const result = await run(favorites());

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('does nothing when the route declares no feature', async () => {
      const result = await run(favorites({ meta: {} }));

      expect(result).toBeUndefined();
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('takes the locale from the URL, not the cookie, when they disagree', async () => {
      mockLocaleCookie = 'sv';

      await run(
        favorites({
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
        favorites({
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
        favorites({
          path: '/fi/da/portal/favorites',
          fullPath: '/fi/da/portal/favorites',
        }),
      );

      expect(mockNavigateTo).toHaveBeenCalledWith('/fi/da/', { replace: true });
    });

    it('falls back to cookies, then config, then the se/sv pair', async () => {
      await run(favorites());
      expect(mockNavigateTo).toHaveBeenCalledWith('/se/en/', { replace: true });

      mockNavigateTo.mockClear();
      mockLocaleCookie = null;
      mockMarketCookie = null;
      mockTenantData.value = createMockTenantConfig({
        features: { wishlist: { enabled: false } },
        locale: 'da-DK',
        market: 'dk',
      });
      await run(favorites());
      expect(mockNavigateTo).toHaveBeenCalledWith('/dk/da/', { replace: true });

      mockNavigateTo.mockClear();
      mockTenantData.value = createMockTenantConfig({
        features: { wishlist: { enabled: false } },
      });
      await run(favorites());
      expect(mockNavigateTo).toHaveBeenCalledWith('/se/sv/', { replace: true });
    });
  });
});
