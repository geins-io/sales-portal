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
const mockGetQuery = vi.fn();

vi.stubGlobal('setCookie', mockSetCookie);
vi.stubGlobal('sendRedirect', mockSendRedirect);
vi.stubGlobal('getCookie', mockGetCookie);
vi.stubGlobal('deleteCookie', mockDeleteCookie);
vi.stubGlobal('getRequestHost', mockGetRequestHost);
vi.stubGlobal('createError', mockCreateError);
vi.stubGlobal('getTenantCookie', mockGetTenantCookie);
vi.stubGlobal('setTenantCookie', mockSetTenantCookie);
vi.stubGlobal('getQuery', mockGetQuery);

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
const mockResolvePreviewTenant = vi.fn();

vi.mock('../../../server/utils/tenant', () => ({
  resolveTenant: (...args: unknown[]) => mockResolveTenant(...args),
  resolvePreviewTenant: (...args: unknown[]) =>
    mockResolvePreviewTenant(...args),
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

describe('server/plugins/02.tenant-context', () => {
  let handler: (event: MockEvent) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default: getRequestHost returns a valid hostname
    mockGetRequestHost.mockReturnValue('test.localhost');
    // Default: no cached tenant cookie
    mockGetTenantCookie.mockReturnValue(undefined);
    // Default: no preview query
    mockGetQuery.mockReturnValue({});

    const mod = await import('../../../server/plugins/02.tenant-context');
    const hooks = mod.default as unknown as Record<
      string,
      (event: unknown) => Promise<unknown>
    >;
    handler = hooks.request as (event: MockEvent) => Promise<unknown>;
  });

  // Validation moved to server/middleware/00.locale-market.ts, which is the
  // first point where the URL pair and the tenant are both available. These
  // cases pin the plugin out of that job: it must resolve the tenant and
  // nothing more.
  describe('leaves locale/market resolution alone', () => {
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

  describe('store-settings preview mode', () => {
    it('?preview=1 routes via resolvePreviewTenant', async () => {
      const tenant = makeTenant();
      mockResolvePreviewTenant.mockResolvedValue(tenant);
      mockGetQuery.mockReturnValue({ preview: '1' });

      const event = createEvent('/se/sv/products', {
        localeMarket: { market: 'se', locale: 'sv' },
      });

      await handler(event);

      expect(mockResolvePreviewTenant).toHaveBeenCalledWith(
        'test.localhost',
        event,
      );
      expect(mockResolveTenant).not.toHaveBeenCalled();
    });

    it('store_settings_preview cookie alone (no ?preview=1) routes via resolveTenant (live)', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);
      mockGetQuery.mockReturnValue({});
      // A stale store-settings preview cookie must never reactivate preview:
      // the plugin reads only the query, so a present cookie is ignored.
      mockGetCookie.mockImplementation((_e: unknown, name: string) =>
        name === 'store_settings_preview' ? 'true' : undefined,
      );

      const event = createEvent('/se/sv/products', {
        localeMarket: { market: 'se', locale: 'sv' },
      });

      await handler(event);

      expect(mockResolveTenant).toHaveBeenCalledWith('test.localhost', event);
      expect(mockResolvePreviewTenant).not.toHaveBeenCalled();
    });

    it('no preview signals routes via resolveTenant (regression guard)', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);

      const event = createEvent('/se/sv/products', {
        localeMarket: { market: 'se', locale: 'sv' },
      });

      await handler(event);

      expect(mockResolveTenant).toHaveBeenCalled();
      expect(mockResolvePreviewTenant).not.toHaveBeenCalled();
    });

    it('preview path does not call setTenantCookie', async () => {
      const tenant = makeTenant();
      mockResolvePreviewTenant.mockResolvedValue(tenant);
      mockGetQuery.mockReturnValue({ preview: '1' });

      const event = createEvent('/se/sv/products', {
        localeMarket: { market: 'se', locale: 'sv' },
      });

      await handler(event);

      expect(mockSetTenantCookie).not.toHaveBeenCalled();
    });

    it('preview path does not clear locale/market/cart cookies on tenant switch', async () => {
      const tenant = makeTenant();
      mockResolvePreviewTenant.mockResolvedValue(tenant);
      mockGetQuery.mockReturnValue({ preview: '1' });
      // Simulate stale tenant cookie that would normally trigger cookie wipe
      mockGetTenantCookie.mockReturnValue('a-different-tenant');

      const event = createEvent('/se/sv/products', {
        localeMarket: { market: 'se', locale: 'sv' },
      });

      await handler(event);

      expect(mockDeleteCookie).not.toHaveBeenCalledWith(
        event,
        'locale',
        expect.anything(),
      );
      expect(mockDeleteCookie).not.toHaveBeenCalledWith(
        event,
        'market',
        expect.anything(),
      );
      expect(mockDeleteCookie).not.toHaveBeenCalledWith(
        event,
        'cart_id',
        expect.anything(),
      );
      expect(mockSetTenantCookie).not.toHaveBeenCalled();
    });

    it('API route with ?preview=1 also uses resolvePreviewTenant', async () => {
      const tenant = makeTenant();
      mockResolvePreviewTenant.mockResolvedValue(tenant);
      mockGetQuery.mockReturnValue({ preview: '1' });

      const event = createEvent('/api/config', {});

      await handler(event);

      expect(mockResolvePreviewTenant).toHaveBeenCalledWith(
        'test.localhost',
        event,
      );
      expect(mockResolveTenant).not.toHaveBeenCalled();
    });

    it('API route with store_settings_preview cookie alone (no ?preview=1) uses resolveTenant (live)', async () => {
      const tenant = makeTenant();
      mockResolveTenant.mockResolvedValue(tenant);
      mockGetQuery.mockReturnValue({});
      // Stale preview cookie present on an API request must still route live.
      mockGetCookie.mockImplementation((_e: unknown, name: string) =>
        name === 'store_settings_preview' ? 'true' : undefined,
      );

      const event = createEvent('/api/config', {});

      await handler(event);

      expect(mockResolveTenant).toHaveBeenCalledWith('test.localhost', event);
      expect(mockResolvePreviewTenant).not.toHaveBeenCalled();
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
