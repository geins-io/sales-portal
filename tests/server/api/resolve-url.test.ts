import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';
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
    return fn;
  },
);
vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal(
  'createAppError',
  vi.fn((_code: string, msg: string) => {
    const err = new Error(msg);
    (err as Record<string, unknown>).statusCode = 404;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', { NOT_FOUND: 'NOT_FOUND' });
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
    await expect(handler(createMockEvent())).rejects.toThrow('No entity for URL');
  });

  it('getKey varies by host: same path under two tenants produces distinct cache keys including the path', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/grenror',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'product',
      canonicalAppPath: '/se/sv/p/grenror',
    });

    const eventA = createMockEvent('tenant-a.example.com');
    // Invoke handler so the module loads and capturedGetKey is populated by the stub.
    await handler(eventA);
    expect(capturedGetKey).not.toBeNull();

    const eventB = createMockEvent('tenant-b.example.com');
    const keyA = capturedGetKey!(eventA);
    const keyB = capturedGetKey!(eventB);

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain('tenant-a.example.com');
    expect(keyB).toContain('tenant-b.example.com');
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

    const event = createMockEvent('tenant-a.example.com');
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
});
