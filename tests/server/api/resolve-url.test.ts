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

// Stub Nitro auto-imports
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
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);
vi.stubGlobal('optionalAuth', vi.fn().mockResolvedValue(null));

const createMockEvent = (): H3Event =>
  ({
    context: { tenant: { tenantId: 't1', hostname: 'test.example.com' } },
  }) as unknown as H3Event;

let handler: (event: H3Event) => Promise<unknown>;

describe('GET /api/resolve-url', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
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

  it('sets Cache-Control no-store', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/grenror',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'product',
      canonicalUrl: '/p/grenror',
    });

    const event = createMockEvent();
    await handler(event);

    expect(setResponseHeader).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'no-store',
    );
  });

  it('returns 404 when the resolver returns null', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/missing',
    });
    mockResolveEntityUrl.mockResolvedValue(null);

    await expect(handler(createMockEvent())).rejects.toThrow('No entity for URL');
  });

  it('returns the resolved { type, canonicalUrl } on a hit', async () => {
    (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      path: '/se/sv/grenror-150-150-88',
    });
    mockResolveEntityUrl.mockResolvedValue({
      type: 'product',
      canonicalUrl: '/p/grenror-150-150-88',
    });

    const result = await handler(createMockEvent());

    expect(result).toEqual({
      type: 'product',
      canonicalUrl: '/p/grenror-150-150-88',
    });
    // alias is the last non-empty path segment
    const call = mockResolveEntityUrl.mock.calls[0]![0] as {
      path: string;
      alias: string;
    };
    expect(call.path).toBe('/se/sv/grenror-150-150-88');
    expect(call.alias).toBe('grenror-150-150-88');
  });
});
