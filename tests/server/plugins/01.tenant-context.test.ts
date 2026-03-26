import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Nitro/h3 auto-imports before any module is loaded
// ---------------------------------------------------------------------------
const mockSetCookie = vi.fn();
const mockSendRedirect = vi.fn();
const mockGetCookie = vi.fn();
const mockDeleteCookie = vi.fn();
const mockGetRequestHost = vi.fn();
const mockCreateError = vi.fn(
  (opts: { statusCode: number; message?: string; statusMessage?: string }) => {
    const err = new Error(opts.message ?? opts.statusMessage ?? 'error');
    (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode =
      opts.statusCode;
    return err;
  },
);
const mockGetTenantCookie = vi.fn();
const mockSetTenantCookie = vi.fn();

vi.stubGlobal('setCookie', mockSetCookie);
vi.stubGlobal('sendRedirect', mockSendRedirect);
vi.stubGlobal('getCookie', mockGetCookie);
vi.stubGlobal('deleteCookie', mockDeleteCookie);
vi.stubGlobal('getRequestHost', mockGetRequestHost);
vi.stubGlobal('createError', mockCreateError);
vi.stubGlobal('getTenantCookie', mockGetTenantCookie);
vi.stubGlobal('setTenantCookie', mockSetTenantCookie);

vi.stubGlobal('defineNitroPlugin', (fn: (nitroApp: unknown) => void) => {
  const hooks: Record<string, (event: unknown) => unknown> = {};
  const nitroApp = {
    hooks: {
      hook: (name: string, cb: (event: unknown) => unknown) => {
        hooks[name] = cb;
      },
    },
  };
  fn(nitroApp);
  return hooks;
});

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
const mockResolveTenant = vi.fn();

vi.mock('../../../server/utils/tenant', () => ({
  resolveTenant: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock('#shared/constants/storage', () => ({
  COOKIE_NAMES: {
    LOCALE: 'locale',
    MARKET: 'market',
    CART_ID: 'cart_id',
    TENANT_ID: 'tenant_id',
  },
}));

vi.mock('#shared/utils/locale-market', async (importActual) => {
  // Use the real implementation so validation logic is covered
  return importActual();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockEvent {
  path: string;
  node: { res: { headersSent: boolean } };
  context: Record<string, unknown>;
}

function makeGeinsSettings(overrides?: {
  availableLocales?: string[];
  availableMarkets?: string[];
  defaultLocale?: string;
  defaultMarket?: string;
}) {
  return {
    availableLocales: overrides?.availableLocales ?? ['sv-SE', 'en-US'],
    availableMarkets: overrides?.availableMarkets ?? ['se', 'no', 'dk'],
    locale: overrides?.defaultLocale ?? 'sv-SE',
    market: overrides?.defaultMarket ?? 'se',
  };
}

function makeTenant(geinsSettings = makeGeinsSettings()) {
  return {
    tenantId: 'test-tenant',
    hostname: 'test.localhost',
    geinsSettings,
    isActive: true,
    mode: 'commerce',
  };
}

function createEvent(
  path: string,
  context: Record<string, unknown> = {},
): MockEvent {
  return {
    path,
    node: { res: { headersSent: false } },
    context,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('server/plugins/01.tenant-context — locale/market validation', () => {
  let handler: (event: MockEvent) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default: getRequestHost returns a valid hostname
    mockGetRequestHost.mockReturnValue('test.localhost');
    // Default: no cached tenant cookie
    mockGetTenantCookie.mockReturnValue(undefined);

    const mod = await import('../../../server/plugins/01.tenant-context');
    const hooks = mod.default as unknown as Record<
      string,
      (event: unknown) => Promise<unknown>
    >;
    handler = hooks.request as (event: MockEvent) => Promise<unknown>;
  });

  describe('valid market and locale', () => {
    it('sets resolvedLocaleMarket and does not redirect', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/se/sv/products', {
        localeMarket: { market: 'se', locale: 'sv' },
      });

      await handler(event);

      expect(mockSendRedirect).not.toHaveBeenCalled();
      expect(event.context.resolvedLocaleMarket).toEqual({
        market: 'se',
        locale: 'sv',
        localeBcp47: 'sv-SE',
      });
    });

    it('sets resolvedLocaleMarket for a valid secondary market and locale', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/no/en/products', {
        localeMarket: { market: 'no', locale: 'en' },
      });

      await handler(event);

      expect(mockSendRedirect).not.toHaveBeenCalled();
      expect(event.context.resolvedLocaleMarket).toMatchObject({
        market: 'no',
        locale: 'en',
        localeBcp47: 'en-US',
      });
    });
  });

  describe('invalid market', () => {
    it('redirects to corrected URL with default market and resets cookies', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/xx/sv/products', {
        localeMarket: { market: 'xx', locale: 'sv' },
      });

      await handler(event);

      expect(mockSendRedirect).toHaveBeenCalledWith(
        event,
        '/se/sv/products',
        302,
      );
      expect(mockSetCookie).toHaveBeenCalledWith(
        event,
        'locale',
        'sv',
        expect.objectContaining({ path: '/' }),
      );
      expect(mockSetCookie).toHaveBeenCalledWith(
        event,
        'market',
        'se',
        expect.objectContaining({ path: '/' }),
      );
    });
  });

  describe('invalid locale', () => {
    it('redirects to corrected URL with default locale and resets cookies', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/se/zz/products', {
        localeMarket: { market: 'se', locale: 'zz' },
      });

      await handler(event);

      expect(mockSendRedirect).toHaveBeenCalledWith(
        event,
        '/se/sv/products',
        302,
      );
      expect(mockSetCookie).toHaveBeenCalledWith(
        event,
        'locale',
        'sv',
        expect.objectContaining({ path: '/' }),
      );
      expect(mockSetCookie).toHaveBeenCalledWith(
        event,
        'market',
        'se',
        expect.objectContaining({ path: '/' }),
      );
    });
  });

  describe('both market and locale invalid', () => {
    it('redirects with both defaults', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/xx/zz/products', {
        localeMarket: { market: 'xx', locale: 'zz' },
      });

      await handler(event);

      expect(mockSendRedirect).toHaveBeenCalledWith(
        event,
        '/se/sv/products',
        302,
      );
    });
  });

  describe('query string preservation', () => {
    it('preserves query string in redirect when locale is invalid', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/se/zz/products?page=2&sort=name', {
        localeMarket: { market: 'se', locale: 'zz' },
      });

      await handler(event);

      expect(mockSendRedirect).toHaveBeenCalledWith(
        event,
        '/se/sv/products?page=2&sort=name',
        302,
      );
    });

    it('preserves query string in redirect for root path', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/xx/sv/?ref=promo', {
        localeMarket: { market: 'xx', locale: 'sv' },
      });

      await handler(event);

      expect(mockSendRedirect).toHaveBeenCalledWith(
        event,
        '/se/sv/?ref=promo',
        302,
      );
    });
  });

  describe('no localeMarket in context (API route or non-prefixed path)', () => {
    it('does not redirect and does not set resolvedLocaleMarket', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);

      // No localeMarket in context — simulates API route or path without prefix
      const event = createEvent('/se/sv/products', {});

      await handler(event);

      expect(mockSendRedirect).not.toHaveBeenCalled();
      expect(event.context.resolvedLocaleMarket).toBeUndefined();
    });

    it('skips locale/market validation for /api/ routes', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/api/config', {});

      await handler(event);

      // API routes still resolve tenant but skip locale/market validation
      expect(mockSendRedirect).not.toHaveBeenCalled();
      expect(event.context.resolvedLocaleMarket).toBeUndefined();
    });
  });

  describe('en matching en-US vs en-GB (first match wins)', () => {
    it('expands en to en-US when en-US is listed before en-GB', async () => {
      const tenant = makeTenant(
        makeGeinsSettings({
          availableLocales: ['sv-SE', 'en-US', 'en-GB'],
          availableMarkets: ['se', 'no'],
        }),
      );
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/se/en/products', {
        localeMarket: { market: 'se', locale: 'en' },
      });

      await handler(event);

      expect(mockSendRedirect).not.toHaveBeenCalled();
      expect(event.context.resolvedLocaleMarket).toMatchObject({
        locale: 'en',
        localeBcp47: 'en-US',
      });
    });

    it('expands en to en-GB when en-GB is listed before en-US', async () => {
      const tenant = makeTenant(
        makeGeinsSettings({
          availableLocales: ['sv-SE', 'en-GB', 'en-US'],
          availableMarkets: ['se', 'no'],
        }),
      );
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/se/en/products', {
        localeMarket: { market: 'se', locale: 'en' },
      });

      await handler(event);

      expect(mockSendRedirect).not.toHaveBeenCalled();
      expect(event.context.resolvedLocaleMarket).toMatchObject({
        locale: 'en',
        localeBcp47: 'en-GB',
      });
    });
  });

  describe('headersSent guard', () => {
    it('returns early without processing if headers already sent', async () => {
      const event = createEvent('/se/sv/products', {
        localeMarket: { market: 'se', locale: 'sv' },
      });
      event.node.res.headersSent = true;

      await handler(event);

      expect(mockResolveTenant).not.toHaveBeenCalled();
      expect(mockSendRedirect).not.toHaveBeenCalled();
    });
  });
});
