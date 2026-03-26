import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Nitro/h3 auto-imports
const mockSetCookie = vi.fn();
const mockGetCookie = vi.fn();
const mockSendRedirect = vi.fn();
vi.stubGlobal('setCookie', mockSetCookie);
vi.stubGlobal('getCookie', mockGetCookie);
vi.stubGlobal('sendRedirect', mockSendRedirect);
vi.stubGlobal('defineNitroPlugin', (fn: (nitroApp: unknown) => void) => {
  // Capture the hook callback for testing
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
vi.stubGlobal('defineEventHandler', (fn: (event: unknown) => unknown) => fn);

vi.mock('#shared/constants/storage', () => ({
  COOKIE_NAMES: {
    LOCALE: 'locale',
    MARKET: 'market',
  },
}));

interface MockEvent {
  path: string;
  _path?: string;
  node: { req: { url: string } };
  context: Record<string, unknown>;
}

/**
 * Creates a mock event for plugin tests (no tenant config available).
 */
function createPluginEvent(path: string): MockEvent {
  const event: MockEvent = {
    _path: undefined,
    node: { req: { url: path } },
    context: {},
    get path() {
      return this._path ?? this.node.req.url;
    },
  };
  return event;
}

/**
 * Creates a mock event for validation middleware tests (with tenant config).
 */
function createValidationEvent(
  path: string,
  options?: {
    localeMarket?: { market: string; locale: string };
    availableMarkets?: string[];
    availableLocales?: string[];
    defaultMarket?: string;
    defaultLocale?: string;
    noTenant?: boolean;
  },
): MockEvent {
  const {
    localeMarket,
    availableMarkets = ['se', 'no', 'dk'],
    availableLocales = ['sv-SE', 'en-US'],
    defaultMarket = 'se',
    defaultLocale = 'sv-SE',
    noTenant = false,
  } = options ?? {};

  const tenant = noTenant
    ? undefined
    : {
        config: {
          geinsSettings: {
            availableMarkets,
            availableLocales,
            market: defaultMarket,
            locale: defaultLocale,
          },
        },
      };

  const context: Record<string, unknown> = {};
  if (tenant) context.tenant = tenant;
  if (localeMarket) context.localeMarket = localeMarket;

  const event: MockEvent = {
    _path: undefined,
    node: { req: { url: path } },
    context,
    get path() {
      return this._path ?? this.node.req.url;
    },
  };
  return event;
}

describe('server/plugins/00.locale-market (Nitro plugin)', () => {
  let pluginHandler: (event: MockEvent) => unknown;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('../../server/plugins/00.locale-market');
    // defineNitroPlugin mock returns the hooks object
    const hooks = mod.default as unknown as Record<
      string,
      (event: unknown) => unknown
    >;
    pluginHandler = hooks.request as (event: MockEvent) => unknown;
  });

  describe('URL prefix parsing (no rewrite)', () => {
    it('should parse market/locale prefix and set context without rewriting URL', () => {
      const event = createPluginEvent('/se/sv/foder');
      pluginHandler(event);

      // URL is NOT rewritten — Vue Router handles prefixed routes natively
      expect(event.path).toBe('/se/sv/foder');
      expect(event.node.req.url).toBe('/se/sv/foder');
      expect(event.context.localeMarket).toEqual({
        market: 'se',
        locale: 'sv',
      });
    });

    it('should accept any two 2-letter segments as market/locale', () => {
      const event = createPluginEvent('/xx/yy/some-page');
      pluginHandler(event);

      // URL preserved, context set
      expect(event.path).toBe('/xx/yy/some-page');
      expect(event.context.localeMarket).toEqual({
        market: 'xx',
        locale: 'yy',
      });
    });

    it('should preserve nested paths', () => {
      const event = createPluginEvent('/no/en/p/category/product-name');
      pluginHandler(event);

      expect(event.path).toBe('/no/en/p/category/product-name');
      expect(event.context.localeMarket).toEqual({
        market: 'no',
        locale: 'en',
      });
    });

    it('should handle bare market/locale without trailing content', () => {
      const event = createPluginEvent('/se/sv');
      pluginHandler(event);

      expect(event.path).toBe('/se/sv');
      expect(event.context.localeMarket).toEqual({
        market: 'se',
        locale: 'sv',
      });
    });

    it('should set cookies with extracted values', () => {
      const event = createPluginEvent('/se/sv/foder');
      pluginHandler(event);

      expect(mockSetCookie).toHaveBeenCalledTimes(2);
      expect(mockSetCookie).toHaveBeenCalledWith(
        event,
        'market',
        'se',
        expect.objectContaining({ path: '/' }),
      );
      expect(mockSetCookie).toHaveBeenCalledWith(
        event,
        'locale',
        'sv',
        expect.objectContaining({ path: '/' }),
      );
    });

    it('should store parsed values in event context', () => {
      const event = createPluginEvent('/dk/en/some-page');
      pluginHandler(event);

      expect(event.context.localeMarket).toEqual({
        market: 'dk',
        locale: 'en',
      });
    });

    it('should preserve query string', () => {
      const event = createPluginEvent('/se/sv/foder?page=2&sort=name');
      pluginHandler(event);

      expect(event.path).toBe('/se/sv/foder?page=2&sort=name');
      expect(event.context.localeMarket).toEqual({
        market: 'se',
        locale: 'sv',
      });
    });
  });

  describe('non-matching paths (no prefix)', () => {
    it('should not modify URLs without a 2-letter prefix pair', () => {
      const event = createPluginEvent('/foder');
      pluginHandler(event);

      expect(mockSetCookie).not.toHaveBeenCalled();
      expect(event.path).toBe('/foder');
    });

    it('should not modify single-segment paths', () => {
      const event = createPluginEvent('/contact');
      pluginHandler(event);

      expect(mockSetCookie).not.toHaveBeenCalled();
      expect(event.path).toBe('/contact');
    });

    it('should not match when second segment is longer than 2 chars', () => {
      const event = createPluginEvent('/se/foder');
      pluginHandler(event);

      // "foder" is 5 chars, not 2 — should NOT be treated as locale
      expect(mockSetCookie).not.toHaveBeenCalled();
      expect(event.path).toBe('/se/foder');
    });

    it('should not match when first segment is longer than 2 chars', () => {
      const event = createPluginEvent('/category/product-name');
      pluginHandler(event);

      expect(mockSetCookie).not.toHaveBeenCalled();
      expect(event.path).toBe('/category/product-name');
    });
  });

  describe('root redirect', () => {
    it('should redirect / using cookie values', () => {
      mockGetCookie.mockImplementation((_event: MockEvent, name: string) => {
        if (name === 'market') return 'no';
        if (name === 'locale') return 'sv';
        return undefined;
      });

      const event = createPluginEvent('/');
      pluginHandler(event);

      expect(mockSendRedirect).toHaveBeenCalledWith(event, '/no/sv/', 302);
    });

    it('should use env-based fallbacks when no cookies set', () => {
      mockGetCookie.mockReturnValue(undefined);

      const event = createPluginEvent('/');
      pluginHandler(event);

      // Fallback: market 'se', locale from GEINS_LOCALE env or 'sv'
      expect(mockSendRedirect).toHaveBeenCalledWith(event, '/se/sv/', 302);
    });

    it('should ignore non-2-letter cookie values', () => {
      mockGetCookie.mockImplementation((_event: MockEvent, name: string) => {
        if (name === 'market') return 'invalid';
        if (name === 'locale') return 'xx';
        return undefined;
      });

      const event = createPluginEvent('/');
      pluginHandler(event);

      // 'invalid' is not 2-letter, falls back to 'se'; 'xx' is valid 2-letter
      expect(mockSendRedirect).toHaveBeenCalledWith(event, '/se/xx/', 302);
    });
  });

  describe('skip non-page routes', () => {
    it('should skip /api/ routes', () => {
      const event = createPluginEvent('/api/config');
      pluginHandler(event);

      expect(mockSetCookie).not.toHaveBeenCalled();
      expect(mockSendRedirect).not.toHaveBeenCalled();
    });

    it('should skip /_nuxt/ routes', () => {
      const event = createPluginEvent('/_nuxt/entry.js');
      pluginHandler(event);

      expect(mockSetCookie).not.toHaveBeenCalled();
    });

    it('should skip /__nuxt routes', () => {
      const event = createPluginEvent('/__nuxt_error');
      pluginHandler(event);

      expect(mockSetCookie).not.toHaveBeenCalled();
    });
  });

  describe('trailing slash normalization', () => {
    it('should redirect trailing slash to non-trailing for non-root paths', () => {
      const event = createPluginEvent('/se/sv/foder/');
      pluginHandler(event);

      expect(mockSendRedirect).toHaveBeenCalledWith(event, '/se/sv/foder', 301);
    });

    it('should keep trailing slash for /{market}/{locale}/ root form', () => {
      const event = createPluginEvent('/se/sv/');
      pluginHandler(event);

      // Should parse prefix and set cookies, no redirect
      expect(mockSendRedirect).not.toHaveBeenCalled();
      expect(mockSetCookie).toHaveBeenCalledTimes(2);
      expect(event.context.localeMarket).toEqual({
        market: 'se',
        locale: 'sv',
      });
    });
  });
});

describe('server/middleware/locale-market-validate (no-op placeholder)', () => {
  let handler: (event: MockEvent) => unknown;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('../../server/middleware/locale-market-validate');
    handler = mod.default as unknown as (event: MockEvent) => unknown;
  });

  it('should return without redirecting (no-op)', () => {
    const event = createValidationEvent('/xx/yy/some-page', {
      localeMarket: { market: 'xx', locale: 'yy' },
    });
    handler(event);

    expect(mockSendRedirect).not.toHaveBeenCalled();
  });

  it('should return without redirecting for unprefixed URLs', () => {
    const event = createValidationEvent('/foder');
    handler(event);

    expect(mockSendRedirect).not.toHaveBeenCalled();
  });
});
