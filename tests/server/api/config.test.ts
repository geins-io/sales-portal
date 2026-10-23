import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import { createError, isError } from 'h3';

const mockGetPublicConfig = vi.fn();
const mockAssetHostRetryDue = vi.fn();

vi.mock('../../../server/services/tenant-config', () => ({
  getPublicConfig: (...args: unknown[]) => mockGetPublicConfig(...args),
  assetHostRetryDue: (...args: unknown[]) => mockAssetHostRetryDue(...args),
}));

vi.mock('../../../server/utils/logger', () => ({
  createTenantLogger: () => ({ debug: vi.fn() }),
}));

type CacheOptions = {
  getKey?: (event: H3Event) => string;
  swr?: boolean;
  maxAge?: number;
  shouldInvalidateCache?: (event: H3Event) => boolean;
};
let cacheOptions: CacheOptions = {};

vi.stubGlobal(
  'defineCachedEventHandler',
  (fn: unknown, options: CacheOptions) => {
    cacheOptions = options;
    return fn;
  },
);
vi.stubGlobal('withErrorHandling', (fn: () => unknown) => fn());
vi.stubGlobal(
  'getQuery',
  vi.fn(() => ({})),
);
vi.stubGlobal('createError', createError);

// Imported once: the node project runs with `isolate: false`, so a
// resetModules per test re-evaluates the tenant utils graph in a worker shared
// with other files, which pushed their tests past the 5 s timeout.
const { default: configHandler, resolveConfigCacheKey } =
  await import('../../../server/api/config.get');
const handler = configHandler as unknown as (
  event: H3Event,
) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
});

function createEvent(resolution?: string): H3Event {
  return {
    context: { tenant: { hostname: 'nope.litium.test', resolution } },
  } as unknown as H3Event;
}

async function rejection(event: H3Event) {
  const error: unknown = await handler(event).then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!isError(error)) throw new Error('expected the handler to throw');
  return error;
}

describe('GET /api/config', () => {
  it('caches under the storefront key', () => {
    const event = createEvent('resolved');

    expect(cacheOptions.getKey?.(event)).toBe(resolveConfigCacheKey(event));
  });

  // These set the response's `s-maxage=3600, stale-while-revalidate`.
  it('serves a resolved config stale-while-revalidate for an hour', () => {
    expect(cacheOptions).toMatchObject({ swr: true, maxAge: 3600 });
  });

  // With an entry present, SWR still answers from it and refreshes behind.
  it.each([true, false])(
    'refreshes the cached config when an asset-host retry is due (%s)',
    (due) => {
      mockAssetHostRetryDue.mockReturnValue(due);
      const event = createEvent('resolved');

      expect(cacheOptions.shouldInvalidateCache?.(event)).toBe(due);
      expect(mockAssetHostRetryDue).toHaveBeenCalledWith(event);
    },
  );

  it('returns the public config for a resolved tenant', async () => {
    const config = { tenantId: 'acme', hostname: 'acme.litium.store' };
    mockGetPublicConfig.mockResolvedValue(config);

    await expect(handler(createEvent('resolved'))).resolves.toBe(config);
  });

  // A page for the same host answers 404 (tenant-context plugin); a null
  // return here would answer 204 instead.
  it.each(['unknown-tenant', 'invalid-config', 'negative-cache'])(
    'answers 404 for an unresolved tenant (%s), the same as a page',
    async (resolution) => {
      mockGetPublicConfig.mockResolvedValue(null);

      const error = await rejection(createEvent(resolution));

      expect(error.statusCode).toBe(404);
      expect(error.statusMessage).toBe('Not Found');
      expect(error.message).toContain('This site is not available');
    },
  );

  it('answers 503 when the merchant API could not be reached', async () => {
    mockGetPublicConfig.mockResolvedValue(null);

    const error = await rejection(createEvent('transport-failure'));

    expect(error.statusCode).toBe(503);
    expect(error.statusMessage).toBe('Service Unavailable');
  });

  // Refusals the plugin makes before any lookup, as it sets them for a page.
  it.each([
    {
      name: 'a missing host header',
      hostname: '',
      refusal: {
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Missing host header',
      },
    },
    {
      name: 'a loopback host in development',
      hostname: 'localhost',
      refusal: {
        statusCode: 404,
        statusMessage: 'Not Found',
        message:
          'localhost does not name a store. Open http://<name>.litium.test:3000 instead.',
        isDevSetup: true,
      },
    },
  ])('answers $name with the page refusal', async ({ hostname, refusal }) => {
    mockGetPublicConfig.mockResolvedValue(null);
    const event = {
      context: { tenant: { hostname }, tenantRefusal: refusal },
    } as unknown as H3Event;

    const error = await rejection(event);

    expect(error.statusCode).toBe(refusal.statusCode);
    expect(error.statusMessage).toBe(refusal.statusMessage);
    expect(error.message).toBe(refusal.message);
  });
});
