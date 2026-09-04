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
// Why the lookup returned null; `resolveTenantOutcome` reports it beside the config.
let mockOutcome = 'unknown-tenant';

vi.mock('../../../server/utils/tenant', () => ({
  resolveTenantOutcome: async (...args: unknown[]) => {
    const config = await mockResolveTenant(...args);
    return { config, outcome: config ? 'resolved' : mockOutcome };
  },
  resolvePreviewTenant: (...args: unknown[]) =>
    mockResolvePreviewTenant(...args),
}));

const mockBuildErrorResponse = vi.fn((_event: unknown, input: unknown) => ({
  statusCode: (input as { statusCode: number }).statusCode,
  statusMessage: 'mocked',
  headers: { 'content-type': 'text/html; charset=utf-8' },
  body: '<!doctype html>mocked',
}));

vi.mock('../../../server/error', () => ({
  buildErrorResponse: (...args: unknown[]) =>
    mockBuildErrorResponse(args[0], args[1]),
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

interface RenderContext {
  event: MockEvent;
  response?: unknown;
}

describe('server/plugins/02.tenant-context', () => {
  let handler: (event: MockEvent) => Promise<unknown>;
  let renderBefore: (ctx: RenderContext) => unknown;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default: getRequestHost returns a valid hostname
    mockGetRequestHost.mockReturnValue('test.localhost');
    // Default: no cached tenant cookie
    mockGetTenantCookie.mockReturnValue(undefined);
    // Default: no preview query
    mockGetQuery.mockReturnValue({});
    mockOutcome = 'unknown-tenant';

    const mod = await import('../../../server/plugins/02.tenant-context');
    const hooks = mod.default as unknown as Record<
      string,
      (event: unknown) => Promise<unknown>
    >;
    handler = hooks.request as (event: MockEvent) => Promise<unknown>;
    renderBefore = hooks['render:before'] as unknown as (
      ctx: RenderContext,
    ) => unknown;
  });

  // A throw inside the Nitro `request` hook is captured, not answered; the
  // request would go on into the renderer and fail there as a 500. The plugin
  // therefore records the refusal and answers it in `render:before`.
  describe('refuses requests that have no tenant', () => {
    it('does not throw for an unregistered hostname; records a 404 refusal', async () => {
      mockResolveTenant.mockResolvedValue(null);
      const event = createEvent('/se/sv/', {});

      await expect(handler(event)).resolves.toBeUndefined();

      expect(mockCreateError).not.toHaveBeenCalled();
      expect(event.context.tenantRefusal).toMatchObject({
        statusCode: 404,
        statusMessage: 'Not Found',
        isTenantNotProvisioned: true,
      });
      expect(
        (event.context.tenantRefusal as { message: string }).message,
      ).toContain('This site is not available');
      expect(
        (event.context.tenant as { tenantId?: string }).tenantId,
      ).toBeUndefined();
      expect(mockSetTenantCookie).not.toHaveBeenCalled();
    });

    it('answers the refusal in render:before without rendering', async () => {
      mockResolveTenant.mockResolvedValue(null);
      const event = createEvent('/se/sv/', {});
      await handler(event);

      const ctx: RenderContext = { event };
      renderBefore(ctx);

      expect(mockBuildErrorResponse).toHaveBeenCalledWith(
        event,
        event.context.tenantRefusal,
      );
      expect(ctx.response).toMatchObject({ statusCode: 404 });
    });

    it('records a 503 refusal when the merchant API could not be reached', async () => {
      mockResolveTenant.mockResolvedValue(null);
      mockOutcome = 'transport-failure';
      const event = createEvent('/se/sv/', {});

      await expect(handler(event)).resolves.toBeUndefined();

      expect(event.context.tenantRefusal).toMatchObject({
        statusCode: 503,
        statusMessage: 'Service Unavailable',
      });
      expect(
        (event.context.tenantRefusal as { isTenantNotProvisioned?: boolean })
          .isTenantNotProvisioned,
      ).toBeUndefined();
      expect((event.context.tenant as { resolution?: string }).resolution).toBe(
        'transport-failure',
      );
    });

    it('leaves the outcome on the context for /api/ requests without a tenant', async () => {
      mockResolveTenant.mockResolvedValue(null);
      mockOutcome = 'transport-failure';
      const event = createEvent('/api/config', {});

      await handler(event);

      expect(event.context.tenantRefusal).toBeUndefined();
      expect(event.context.tenant).toMatchObject({
        hostname: 'test.localhost',
        resolution: 'transport-failure',
      });
    });

    it('records a 400 refusal when the host header is missing', async () => {
      mockGetRequestHost.mockReturnValue('');
      const event = createEvent('/se/sv/', {});

      await expect(handler(event)).resolves.toBeUndefined();

      expect(event.context.tenantRefusal).toMatchObject({
        statusCode: 400,
        message: 'Missing host header',
      });
      expect(mockResolveTenant).not.toHaveBeenCalled();
    });

    it('leaves render:before alone when the tenant resolved', async () => {
      mockResolveTenant.mockResolvedValue(makeTenant());
      const event = createEvent('/se/sv/', {});
      await handler(event);

      const ctx: RenderContext = { event };
      renderBefore(ctx);

      expect(event.context.tenantRefusal).toBeUndefined();
      expect(ctx.response).toBeUndefined();
      expect(mockBuildErrorResponse).not.toHaveBeenCalled();
    });

    it('does not refuse /api/ requests; their handlers own the missing tenant', async () => {
      mockResolveTenant.mockResolvedValue(null);
      const event = createEvent('/api/config', {});

      await handler(event);

      expect(event.context.tenantRefusal).toBeUndefined();
    });
  });

  // Server-internal fetches reach this hook as their own requests. The lookup
  // must run for the hostname they carry (internalFetch forwards it), and not
  // at all for routes that cannot carry one.
  describe('internal requests', () => {
    it('looks up /api/ requests by the hostname they carry', async () => {
      mockGetRequestHost.mockReturnValue('tenant-x.example');
      mockResolveTenant.mockResolvedValue(makeTenant());
      const event = createEvent('/api/auth/me', {});

      await handler(event);

      expect(mockResolveTenant).toHaveBeenCalledTimes(1);
      expect(mockResolveTenant.mock.calls[0]?.[0]).toBe('tenant-x.example');
      expect(mockGetRequestHost).toHaveBeenCalledWith(event, {
        xForwardedHost: false,
      });
    });

    it('does no tenant lookup for the i18n message route', async () => {
      const event = createEvent('/_i18n/abc123/sv/messages.json', {});

      await handler(event);

      expect(mockResolveTenant).not.toHaveBeenCalled();
      expect(mockResolvePreviewTenant).not.toHaveBeenCalled();
      expect(event.context.tenantRefusal).toBeUndefined();
      expect(event.context.tenant).toEqual({ hostname: 'test.localhost' });
    });

    it('does no tenant lookup for build assets', async () => {
      for (const path of ['/_nuxt/entry.js', '/__nuxt_error']) {
        const event = createEvent(path, {});
        await handler(event);
        expect(mockResolveTenant).not.toHaveBeenCalled();
        expect(event.context.tenantRefusal).toBeUndefined();
      }
    });
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
