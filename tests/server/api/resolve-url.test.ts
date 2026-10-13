import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { ZodError } from 'zod';
import { createEvent, handleCacheHeaders } from 'h3';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// Mock the resolver service (the boundary the endpoint calls). Real zod runs.
// ---------------------------------------------------------------------------
const mockResolveEntityUrl = vi.fn();

vi.mock('../../../server/services/url-resolver', () => ({
  resolveEntityUrl: (...args: unknown[]) => mockResolveEntityUrl(...args),
}));

// Capture the inner handler and getKey fn registered with defineCachedEventHandler.
// The stub below is a pass-through: it stores both references for test assertions
// and immediately returns the inner fn so the endpoint behaves normally.
let capturedInnerHandler: ((event: H3Event) => Promise<unknown>) | null = null;
let capturedGetKey: ((event: H3Event) => string) | null = null;
type CachedCall = (
  fn: (event: H3Event) => Promise<unknown>,
  event: H3Event,
) => Promise<unknown>;
const runUncached: CachedCall = (fn, event) => fn(event);
let cachedCall: CachedCall = runUncached;

const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();
vi.mock('../../../server/utils/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Stub Nitro auto-imports
vi.stubGlobal(
  'defineCachedEventHandler',
  (
    fn: (event: H3Event) => Promise<unknown>,
    opts: { getKey?: (event: H3Event) => string },
  ) => {
    capturedInnerHandler = fn;
    capturedGetKey = opts.getKey ?? null;
    // Return a thin wrapper that runs the inner fn directly (no real caching in tests).
    return (event: H3Event) => cachedCall(fn, event);
  },
);
const passThroughErrorHandling = async (fn: () => Promise<unknown>) => fn();
const stubCreateAppError = vi.fn((_code: string, msg: string) => {
  const err: Error & { statusCode?: number } = new Error(msg);
  err.statusCode = 404;
  return err;
});
const stubErrorCode = { NOT_FOUND: 'NOT_FOUND' };
vi.stubGlobal('withErrorHandling', passThroughErrorHandling);
vi.stubGlobal('createAppError', stubCreateAppError);
vi.stubGlobal('ErrorCode', stubErrorCode);
vi.stubGlobal('getQuery', vi.fn());
vi.stubGlobal('setResponseHeader', vi.fn());
// defineEventHandler is no longer used by the endpoint (replaced by defineCachedEventHandler)
// but keep a pass-through stub so any residual import does not break.
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);
vi.stubGlobal('optionalAuth', vi.fn().mockResolvedValue(null));
// getRequestHost is used by the endpoint's getKey helper.
// The real h3 getRequestHost always returns a string (the Host header value);
// the upstream tenant plugin 400s before this handler if the host is empty.
vi.stubGlobal(
  'getRequestHost',
  vi.fn((event: H3Event) => {
    return (event as unknown as { context: { tenant: { hostname: string } } })
      .context.tenant.hostname;
  }),
);

const createMockEvent = (hostname = 'test.example.com'): H3Event =>
  ({
    context: { tenant: { tenantId: 't1', hostname } },
  }) as unknown as H3Event;

// Event carrying the tenant geinsSettings the endpoint reads to resolve the
// path's own market/locale. Swedish-default tenant that also serves English.
const createMockEventWithSettings = (hostname = 'test.example.com'): H3Event =>
  ({
    context: {
      tenant: {
        tenantId: 't1',
        hostname,
        config: {
          geinsSettings: {
            locale: 'sv-SE',
            market: 'se',
            availableLocales: ['sv-SE', 'en-US'],
            availableMarkets: ['se'],
          },
        },
      },
    },
  }) as unknown as H3Event;

const readResolvedLocaleMarket = (event: H3Event) =>
  (
    event as unknown as {
      context: {
        resolvedLocaleMarket?: {
          market: string;
          locale: string;
          localeBcp47: string;
        };
      };
    }
  ).context.resolvedLocaleMarket;

let handler: (event: H3Event) => Promise<unknown>;

describe('GET /api/resolve-url', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    capturedInnerHandler = null;
    capturedGetKey = null;
    (optionalAuth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    vi.resetModules();
    const mod = await import('../../../server/api/resolve-url.get');
    handler = mod.default as (event: H3Event) => Promise<unknown>;
  });

  it('rejects a request with no path (zod 400)', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({});

    await expect(handler(createMockEvent())).rejects.toThrow(ZodError);
  });

  it('rejects an empty path (zod 400)', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({ path: '' });

    await expect(handler(createMockEvent())).rejects.toThrow(ZodError);
  });

  it('does NOT set Cache-Control no-store (caching is now enabled via defineCachedEventHandler)', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/grenror',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'product',
      canonicalAppPath: '/se/sv/p/grenror',
    });

    const event = createMockEvent();
    await handler(event);

    // setResponseHeader must not have been called at all (no Cache-Control manipulation).
    expect(setResponseHeader).not.toHaveBeenCalled();
  });

  it('returns the resolved { type, canonicalAppPath } on a hit (normalized shape)', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/grenror-150-150-88',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'product',
      canonicalAppPath: '/se/sv/p/material/grenror/grenror-150-150-88',
    });

    const result = await handler(createMockEvent());

    expect(result).toEqual({
      type: 'product',
      canonicalAppPath: '/se/sv/p/material/grenror/grenror-150-150-88',
    });
    // alias is the last non-empty path segment
    const call = mockResolveEntityUrl.mock.calls[0]![0] as {
      path: string;
      alias: string;
    };
    expect(call.path).toBe('/se/sv/grenror-150-150-88');
    expect(call.alias).toBe('grenror-150-150-88');
  });

  it('returns { redirect } unchanged for a urlHistory rename', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/old-slug',
    });
    mockResolveEntityUrl.mockResolvedValue({ redirect: '/se/sv/new-slug' });

    const result = await handler(createMockEvent());

    expect(result).toEqual({ redirect: '/se/sv/new-slug' });
  });

  it('negative-cache marker: inner handler resolves to { notFound: true }, outer handler rejects with 404', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/missing',
    });
    mockResolveEntityUrl.mockResolvedValue(null);

    // The inner handler must RESOLVE (return the marker) so Nitro can cache it.
    // Call it directly to verify the invariant before the outer handler converts it.
    expect(capturedInnerHandler).not.toBeNull();
    const innerResult = await capturedInnerHandler!(createMockEvent());
    expect(innerResult).toEqual({ notFound: true });

    // The outer handler converts the cached marker to a real 404 throw.
    await expect(handler(createMockEvent())).rejects.toThrow(
      'No entity for URL',
    );
  });

  it('getKey varies by host: same path under two tenants produces distinct cache keys including the path', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/grenror',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'product',
      canonicalAppPath: '/se/sv/p/grenror',
    });

    const eventA = createMockEvent('alpha.example');
    // Invoke handler so the module loads and capturedGetKey is populated by the stub.
    await handler(eventA);
    expect(capturedGetKey).not.toBeNull();

    const eventB = createMockEvent('beta.example');
    const keyA = capturedGetKey!(eventA);
    const keyB = capturedGetKey!(eventB);

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain('alpha.example');
    expect(keyB).toContain('beta.example');
    // Path must also be present in the key so a host-only key bug would fail.
    expect(keyA).toContain('/se/sv/grenror');
  });

  it('getKey normalizes trailing slashes: /se/sv/grenror/ and /se/sv/grenror produce equal keys', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/grenror',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'product',
      canonicalAppPath: '/se/sv/p/grenror',
    });

    const event = createMockEvent('alpha.example');
    await handler(event);
    expect(capturedGetKey).not.toBeNull();

    const eventWithSlash = {
      ...event,
      // Override query for the getKey call only (getQuery is already stubbed globally)
    } as H3Event;

    // Simulate the two paths that must produce the same key.
    // We call capturedGetKey with getQuery returning each path variant.
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/grenror/',
    });
    const keyWithSlash = capturedGetKey!(eventWithSlash);

    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/grenror',
    });
    const keyWithoutSlash = capturedGetKey!(event);

    expect(keyWithSlash).toBe(keyWithoutSlash);
  });

  it("applies the path's own market/locale so a non-default-locale alias resolves in its locale", async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/en/l/categoryone',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'category',
      canonicalAppPath: '/se/en/c/categoryone',
    });

    const event = createMockEventWithSettings();
    await handler(event);

    // The endpoint must set resolvedLocaleMarket to EN before resolving so the
    // downstream Geins queries run in English, not the tenant default (Swedish).
    const resolved = readResolvedLocaleMarket(event);
    expect(resolved).toBeDefined();
    expect(resolved!.market).toBe('se');
    expect(resolved!.locale).toBe('en');
    expect(resolved!.localeBcp47).toBe('en-US');
  });

  it('leaves resolvedLocaleMarket unset for a prefix-less path (default-locale behaviour preserved)', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/material/grenror',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'product',
      canonicalAppPath: '/p/material/grenror',
    });

    const event = createMockEventWithSettings();
    await handler(event);

    expect(readResolvedLocaleMarket(event)).toBeUndefined();
  });

  it('falls back to tenant defaults when the path prefix is not a valid market/locale', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/xx/zz/categoryone',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'category',
      canonicalAppPath: '/se/sv/c/categoryone',
    });

    const event = createMockEventWithSettings();
    await handler(event);

    // 'xx'/'zz' are not in the tenant config, so resolveLocaleMarket corrects
    // both to the tenant defaults rather than querying Geins in a bogus locale.
    const resolved = readResolvedLocaleMarket(event);
    expect(resolved).toBeDefined();
    expect(resolved!.market).toBe('se');
    expect(resolved!.locale).toBe('sv');
    expect(resolved!.localeBcp47).toBe('sv-SE');
  });

  it('resolves anonymously even when the request has a session, because the key has no identity', async () => {
    // Nitro hands the cached handler the incoming event's context, so a session
    // the middleware decided is visible in here.
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/grenror',
    });
    (optionalAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      authToken: 'buyer-token',
      refreshToken: 'buyer-refresh',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'product',
      canonicalAppPath: '/se/sv/p/grenror',
    });

    const event = createMockEvent();
    (event.context as unknown as Record<string, unknown>).session = {
      status: 'active',
      tokens: { authToken: 'buyer-token', refreshToken: 'buyer-refresh' },
    };
    await handler(event);

    expect(mockResolveEntityUrl).toHaveBeenCalledTimes(1);
    expect(mockResolveEntityUrl.mock.calls[0]![0].userToken).toBeUndefined();
  });
});

// A real h3 event over a real node request/response, so h3 itself ends the
// response and sets event.handled.
const createHttpEvent = (headers: Record<string, string> = {}): H3Event => {
  const req = new IncomingMessage(new Socket());
  req.method = 'GET';
  req.url = '/api/resolve-url';
  req.headers = headers;
  const event = createEvent(req, new ServerResponse(req));
  (event.context as Record<string, unknown>).tenant = {
    tenantId: 't1',
    hostname: 'test.example.com',
  };
  return event;
};

describe('GET /api/resolve-url: a revalidated request Nitro answers with 304', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // What Nitro's cached handler does: compute the entry once, answer every
    // request through h3's handleCacheHeaders, and return no value once that
    // has ended the response with 304.
    let entry: { body: unknown; etag: string; modifiedTime: Date } | undefined;
    cachedCall = async (fn, event) => {
      if (!entry) {
        const body = await fn(event);
        const digest = createHash('sha1')
          .update(JSON.stringify(body))
          .digest('hex');
        entry = {
          body,
          etag: `W/"${digest.slice(0, 10)}"`,
          modifiedTime: new Date(new Date().toUTCString()),
        };
      }
      const { etag, modifiedTime } = entry;
      if (handleCacheHeaders(event, { etag, modifiedTime })) return undefined;
      return entry.body;
    };
    // The real error handling, so a crash shows up as the INTERNAL_ERROR log
    // it produces in production.
    const errors = await vi.importActual<
      typeof import('../../../server/utils/errors')
    >('../../../server/utils/errors');
    vi.stubGlobal('withErrorHandling', errors.withErrorHandling);
    vi.stubGlobal('createAppError', errors.createAppError);
    vi.stubGlobal('ErrorCode', errors.ErrorCode);
    vi.resetModules();
    const mod = await import('../../../server/api/resolve-url.get');
    handler = mod.default as (event: H3Event) => Promise<unknown>;
  });

  afterEach(() => {
    cachedCall = runUncached;
    vi.stubGlobal('withErrorHandling', passThroughErrorHandling);
    vi.stubGlobal('createAppError', stubCreateAppError);
    vi.stubGlobal('ErrorCode', stubErrorCode);
  });

  const paths = [
    {
      name: 'found',
      path: '/se/sv/verktyg',
      resolved: { type: 'category', canonicalAppPath: '/se/sv/c/verktyg' },
    },
    { name: 'not found', path: '/se/sv/terms', resolved: null },
  ];
  const conditions = [
    { request: 'if-none-match', response: 'etag' },
    { request: 'if-modified-since', response: 'last-modified' },
  ];

  it.each(paths.flatMap((p) => conditions.map((c) => ({ ...p, ...c }))))(
    'leaves the 304 alone on a $name path revalidated with $request',
    async ({ path, resolved, request, response }) => {
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({ path });
      mockResolveEntityUrl.mockResolvedValue(resolved);

      // First request: the answer the browser caches.
      const firstEvent = createHttpEvent();
      const first = handler(firstEvent);
      if (resolved) {
        await expect(first).resolves.toEqual(resolved);
      } else {
        await expect(first).rejects.toMatchObject({ statusCode: 404 });
      }
      const validator = firstEvent.node.res.getHeader(response);
      expect(typeof validator).toBe('string');

      // Revalidation with that validator: h3 ends the response with 304.
      const event = createHttpEvent({ [request]: validator as string });
      await expect(handler(event)).resolves.toBeUndefined();
      expect(event.node.res.statusCode).toBe(304);
      expect(event.handled).toBe(true);
      expect(mockLoggerError).not.toHaveBeenCalled();
    },
  );
});
