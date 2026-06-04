import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let service functions run for real
// ---------------------------------------------------------------------------
const mockGraphqlQuery = vi.fn();
const mockGraphqlMutation = vi.fn();

const mockSDK = {
  core: {
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' },
    graphql: { query: mockGraphqlQuery, mutation: mockGraphqlMutation },
  },
};

let channelVarsReturn: {
  channelId: string;
  languageId: string;
  marketId: string;
} = { channelId: '1', languageId: 'sv-SE', marketId: 'se' };

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi.fn(() => channelVarsReturn),
}));

// Mock graphql loader (depends on #graphql-queries build-time alias)
vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
}));

// Let unwrapGraphQL run for real — it's pure logic
vi.mock('../../../server/services/graphql/unwrap', () => ({
  unwrapGraphQL: vi.fn((result: unknown) => {
    if (result === null || result === undefined) return result;
    if (typeof result !== 'object' || Array.isArray(result)) return result;
    const keys = Object.keys(result as Record<string, unknown>);
    if (keys.length === 1) {
      return (result as Record<string, unknown>)[keys[0]!];
    }
    return result;
  }),
}));

// Rate limiter — uses useStorage('kv'), must stay mocked
vi.mock('../../../server/utils/rate-limiter', () => ({
  reviewPostRateLimiter: {
    check: vi
      .fn()
      .mockResolvedValue({ allowed: true, remaining: 4, resetTime: 0 }),
  },
  monitorAvailabilityRateLimiter: {
    check: vi
      .fn()
      .mockResolvedValue({ allowed: true, remaining: 9, resetTime: 0 }),
  },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

// ---------------------------------------------------------------------------
// Stub Nitro / h3 auto-imports
// ---------------------------------------------------------------------------
vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal(
  'createAppError',
  vi.fn((_code: string, msg: string) => {
    const err = new Error(msg);
    (err as Error & { statusCode: number }).statusCode = 404;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
});
vi.stubGlobal('setResponseHeader', vi.fn());
vi.stubGlobal('getRouterParam', vi.fn());
vi.stubGlobal('getQuery', vi.fn());
vi.stubGlobal(
  'getValidatedQuery',
  vi.fn(async (_event: unknown, validator: (raw: unknown) => unknown) => {
    const query = (getQuery as ReturnType<typeof vi.fn>)(_event);
    return validator(query);
  }),
);
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal(
  'readValidatedBody',
  vi.fn(async (_event: unknown, validator: (raw: unknown) => unknown) => {
    const body = await (readBody as ReturnType<typeof vi.fn>)(_event);
    return validator(body);
  }),
);
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);
vi.stubGlobal('optionalAuth', vi.fn().mockResolvedValue(null));
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue(undefined));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type Handler = (event: H3Event) => Promise<unknown>;
const fakeEvent = {} as unknown as H3Event;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Product API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =======================================================================
  // GET /api/products/[alias]
  // =======================================================================
  describe('GET /api/products/[alias]', () => {
    let handler: Handler;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('../../../server/api/products/[alias].get.ts');
      handler = mod.default as Handler;
    });

    it('returns product data from SDK graphql query', async () => {
      vi.mocked(getRouterParam).mockReturnValue('my-product');
      mockGraphqlQuery.mockResolvedValue({
        product: { id: 1, name: 'My Product' },
      });

      const result = await handler(fakeEvent);

      expect(result).toEqual({ id: 1, name: 'My Product' });
    });

    it('throws NOT_FOUND when SDK returns null in default locale', async () => {
      vi.mocked(getRouterParam).mockReturnValue('missing');
      mockGraphqlQuery.mockResolvedValue({ product: null });

      await expect(handler(fakeEvent)).rejects.toThrow('Product not found');
    });

    it('sets no-store cache header on 404 so CDN does not cache the miss', async () => {
      vi.mocked(getRouterParam).mockReturnValue('missing');
      mockGraphqlQuery.mockResolvedValue({ product: null });

      await expect(handler(fakeEvent)).rejects.toThrow('Product not found');

      expect(setResponseHeader).toHaveBeenCalledWith(
        fakeEvent,
        'Cache-Control',
        'no-store',
      );
    });

    it('falls back to default locale when non-default locale returns null', async () => {
      vi.mocked(getRouterParam).mockReturnValue('wood-screw-se');
      // SDK default is sv-SE; request was for en-US
      channelVarsReturn = {
        channelId: '1',
        languageId: 'en-US',
        marketId: 'se',
      };
      mockGraphqlQuery
        .mockResolvedValueOnce({ product: null })
        .mockResolvedValueOnce({
          product: { alias: 'wood-screw-se', name: 'Trä SE' },
        });

      try {
        const result = await handler(fakeEvent);

        expect(result).toEqual({ alias: 'wood-screw-se', name: 'Trä SE' });
        expect(mockGraphqlQuery).toHaveBeenCalledTimes(2);
        expect(mockGraphqlQuery.mock.calls[0]?.[0].variables.languageId).toBe(
          'en-US',
        );
        expect(mockGraphqlQuery.mock.calls[1]?.[0].variables.languageId).toBe(
          'sv-SE',
        );
      } finally {
        channelVarsReturn = {
          channelId: '1',
          languageId: 'sv-SE',
          marketId: 'se',
        };
      }
    });

    it('does not retry when requested locale equals SDK default', async () => {
      vi.mocked(getRouterParam).mockReturnValue('missing');
      // Both request and default are sv-SE
      mockGraphqlQuery.mockResolvedValue({ product: null });

      await expect(handler(fakeEvent)).rejects.toThrow('Product not found');

      expect(mockGraphqlQuery).toHaveBeenCalledTimes(1);
    });

    it('throws ZodError for empty alias', async () => {
      vi.mocked(getRouterParam).mockReturnValue('');

      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('throws ZodError for missing alias', async () => {
      vi.mocked(getRouterParam).mockReturnValue(undefined);

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // GET /api/products/[alias]/related
  // =======================================================================
  describe('GET /api/products/[alias]/related', () => {
    let handler: Handler;

    beforeEach(async () => {
      vi.resetModules();
      const mod =
        await import('../../../server/api/products/[alias]/related.get.ts');
      handler = mod.default as Handler;
    });

    it('returns related products from SDK', async () => {
      vi.mocked(getRouterParam).mockReturnValue('my-product');
      mockGraphqlQuery.mockResolvedValue({
        relatedProducts: [{ id: 2, name: 'Related' }],
      });

      const result = await handler(fakeEvent);

      expect(result).toEqual([{ id: 2, name: 'Related' }]);
    });

    it('throws ZodError for empty alias', async () => {
      vi.mocked(getRouterParam).mockReturnValue('');

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // GET /api/products/[alias]/reviews
  // =======================================================================
  describe('GET /api/products/[alias]/reviews', () => {
    let handler: Handler;

    beforeEach(async () => {
      vi.resetModules();
      const mod =
        await import('../../../server/api/products/[alias]/reviews.get.ts');
      handler = mod.default as Handler;
    });

    it('returns reviews from SDK with pagination', async () => {
      vi.mocked(getRouterParam).mockReturnValue('my-product');
      vi.mocked(getQuery).mockReturnValue({ skip: '0', take: '10' });
      mockGraphqlQuery.mockResolvedValue({
        reviews: { items: [{ rating: 5, author: 'Alice' }] },
      });

      const result = await handler(fakeEvent);

      expect(result).toEqual({ items: [{ rating: 5, author: 'Alice' }] });
    });

    it('works without optional query params', async () => {
      vi.mocked(getRouterParam).mockReturnValue('my-product');
      vi.mocked(getQuery).mockReturnValue({});
      mockGraphqlQuery.mockResolvedValue({
        reviews: { items: [] },
      });

      const result = await handler(fakeEvent);

      expect(result).toEqual({ items: [] });
    });

    it('throws ZodError for invalid take value', async () => {
      vi.mocked(getRouterParam).mockReturnValue('my-product');
      vi.mocked(getQuery).mockReturnValue({ take: '999' });

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // POST /api/products/[alias]/reviews
  // =======================================================================
  describe('POST /api/products/[alias]/reviews', () => {
    let handler: Handler;

    beforeEach(async () => {
      vi.resetModules();
      const mod =
        await import('../../../server/api/products/[alias]/reviews.post.ts');
      handler = mod.default as Handler;
    });

    it('posts review through SDK and returns result', async () => {
      vi.mocked(getRouterParam).mockReturnValue('my-product');
      vi.mocked(readBody).mockResolvedValue({
        rating: 5,
        author: 'Alice',
        comment: 'Great!',
      });
      mockGraphqlMutation.mockResolvedValue({ postReview: { ok: true } });

      const result = await handler(fakeEvent);

      expect(result).toEqual({ ok: true });
    });

    it('works without optional comment', async () => {
      vi.mocked(getRouterParam).mockReturnValue('my-product');
      vi.mocked(readBody).mockResolvedValue({
        rating: 3,
        author: 'Bob',
      });
      mockGraphqlMutation.mockResolvedValue({ postReview: { ok: true } });

      const result = await handler(fakeEvent);

      expect(result).toEqual({ ok: true });
    });

    it('throws ZodError for missing rating', async () => {
      vi.mocked(getRouterParam).mockReturnValue('my-product');
      vi.mocked(readBody).mockResolvedValue({ author: 'Alice' });

      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('throws ZodError for rating out of range', async () => {
      vi.mocked(getRouterParam).mockReturnValue('my-product');
      vi.mocked(readBody).mockResolvedValue({
        rating: 6,
        author: 'Alice',
      });

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // GET /api/products/[alias]/price-history
  // =======================================================================
  describe('GET /api/products/[alias]/price-history', () => {
    let handler: Handler;

    beforeEach(async () => {
      vi.resetModules();
      const mod =
        await import('../../../server/api/products/[alias]/price-history.get.ts');
      handler = mod.default as Handler;
    });

    it('returns price history from SDK', async () => {
      vi.mocked(getRouterParam).mockReturnValue('my-product');
      mockGraphqlQuery.mockResolvedValue({
        priceHistory: [{ price: 100, date: '2026-01-01' }],
      });

      const result = await handler(fakeEvent);

      expect(result).toEqual([{ price: 100, date: '2026-01-01' }]);
    });

    it('throws ZodError for empty alias', async () => {
      vi.mocked(getRouterParam).mockReturnValue('');

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // POST /api/products/monitor-availability
  // =======================================================================
  describe('POST /api/products/monitor-availability', () => {
    let handler: Handler;

    beforeEach(async () => {
      vi.resetModules();
      const mod =
        await import('../../../server/api/products/monitor-availability.post.ts');
      handler = mod.default as Handler;
    });

    it('submits monitor request through SDK and returns result', async () => {
      vi.mocked(readBody).mockResolvedValue({
        email: 'user@example.com',
        skuId: 42,
      });
      mockGraphqlMutation.mockResolvedValue({
        monitorAvailability: { ok: true },
      });

      const result = await handler(fakeEvent);

      expect(result).toEqual({ ok: true });
    });

    it('throws ZodError for invalid email', async () => {
      vi.mocked(readBody).mockResolvedValue({
        email: 'not-an-email',
        skuId: 42,
      });

      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('throws ZodError for missing skuId', async () => {
      vi.mocked(readBody).mockResolvedValue({
        email: 'user@example.com',
      });

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // GET /api/products/by-aliases
  // =======================================================================
  describe('GET /api/products/by-aliases', () => {
    let handler: Handler;

    beforeEach(async () => {
      vi.resetModules();
      const mod =
        await import('../../../server/api/products/by-aliases.get.ts');
      handler = mod.default as Handler;
    });

    it('returns products for valid aliases', async () => {
      vi.mocked(getQuery).mockReturnValue({ aliases: 'a,b' });
      mockGraphqlQuery
        .mockResolvedValueOnce({ product: { alias: 'a', name: 'A' } })
        .mockResolvedValueOnce({ product: { alias: 'b', name: 'B' } });

      const result = await handler(fakeEvent);

      expect(result).toEqual({
        products: [
          { alias: 'a', name: 'A' },
          { alias: 'b', name: 'B' },
        ],
      });
    });

    it('rejects empty aliases string', async () => {
      vi.mocked(getQuery).mockReturnValue({ aliases: '' });
      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('rejects more than 50 aliases', async () => {
      const many = Array.from({ length: 51 }, (_, i) => `p${i}`).join(',');
      vi.mocked(getQuery).mockReturnValue({ aliases: many });
      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('omits products returned as null', async () => {
      vi.mocked(getQuery).mockReturnValue({ aliases: 'a,missing' });
      mockGraphqlQuery
        .mockResolvedValueOnce({ product: { alias: 'a', name: 'A' } })
        .mockResolvedValueOnce({ product: null });

      const result = await handler(fakeEvent);

      expect(result).toEqual({ products: [{ alias: 'a', name: 'A' }] });
    });

    it('handles partial failure gracefully', async () => {
      vi.mocked(getQuery).mockReturnValue({ aliases: 'a,b' });
      mockGraphqlQuery
        .mockResolvedValueOnce({ product: { alias: 'a', name: 'A' } })
        .mockRejectedValueOnce(new Error('SDK exploded'));

      const result = await handler(fakeEvent);

      expect(result).toEqual({ products: [{ alias: 'a', name: 'A' }] });
    });

    it('sets public cache header for anonymous requests', async () => {
      vi.mocked(getQuery).mockReturnValue({ aliases: 'a' });
      vi.mocked(optionalAuth).mockResolvedValue(null);
      mockGraphqlQuery.mockResolvedValue({ product: { alias: 'a' } });

      await handler(fakeEvent);

      expect(setResponseHeader).toHaveBeenCalledWith(
        fakeEvent,
        'Cache-Control',
        'public, s-maxage=60, stale-while-revalidate=600',
      );
    });

    it('sets private cache header for authenticated requests', async () => {
      vi.mocked(getQuery).mockReturnValue({ aliases: 'a' });
      vi.mocked(optionalAuth).mockResolvedValue({ authToken: 'tok' });
      mockGraphqlQuery.mockResolvedValue({ product: { alias: 'a' } });

      await handler(fakeEvent);

      expect(setResponseHeader).toHaveBeenCalledWith(
        fakeEvent,
        'Cache-Control',
        'private, no-cache',
      );

      // Reset for other tests
      vi.mocked(optionalAuth).mockResolvedValue(null);
    });

    it('accepts aliases with slashes and dots (forwarded as GraphQL variables)', async () => {
      vi.mocked(getQuery).mockReturnValue({
        aliases: 'manifold-100/100-45,s1.200.050',
      });
      mockGraphqlQuery
        .mockResolvedValueOnce({
          product: { alias: 'manifold-100/100-45', name: 'A' },
        })
        .mockResolvedValueOnce({
          product: { alias: 's1.200.050', name: 'B' },
        });

      const result = await handler(fakeEvent);

      expect(result).toEqual({
        products: [
          { alias: 'manifold-100/100-45', name: 'A' },
          { alias: 's1.200.050', name: 'B' },
        ],
      });
    });

    it('trims whitespace-only aliases before validating', async () => {
      vi.mocked(getQuery).mockReturnValue({ aliases: '  ,  , ' });
      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // GET /api/products/by-ids
  // =======================================================================
  describe('GET /api/products/by-ids', () => {
    let handler: Handler;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('../../../server/api/products/by-ids.get.ts');
      handler = mod.default as Handler;
    });

    it('resolves products in a single id-filtered query', async () => {
      vi.mocked(getQuery).mockReturnValue({ ids: '1069,1070' });
      mockGraphqlQuery.mockResolvedValue({
        products: {
          products: [
            { productId: 1069, alias: 'a', name: 'A', articleNumber: 'X1' },
            { productId: 1070, alias: 'b', name: 'B', articleNumber: 'X2' },
          ],
          count: 2,
        },
      });

      const result = await handler(fakeEvent);

      // One GraphQL call for the whole batch, not one per id.
      expect(mockGraphqlQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        products: [
          { productId: 1069, alias: 'a', name: 'A', articleNumber: 'X1' },
          { productId: 1070, alias: 'b', name: 'B', articleNumber: 'X2' },
        ],
        count: 2,
      });
    });

    it('passes productIds + includeCollapsed + take to the query', async () => {
      vi.mocked(getQuery).mockReturnValue({ ids: '1069,1070,1071' });
      mockGraphqlQuery.mockResolvedValue({
        products: { products: [], count: 0 },
      });

      await handler(fakeEvent);

      const variables = mockGraphqlQuery.mock.calls[0]?.[0].variables;
      expect(variables.filter).toEqual({
        productIds: [1069, 1070, 1071],
        includeCollapsed: true,
      });
      // take must equal the id count so every match returns (no default page).
      expect(variables.take).toBe(3);
    });

    it('rejects empty ids string', async () => {
      vi.mocked(getQuery).mockReturnValue({ ids: '' });
      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('rejects non-numeric ids', async () => {
      vi.mocked(getQuery).mockReturnValue({ ids: 'abc' });
      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('rejects zero and negative ids', async () => {
      vi.mocked(getQuery).mockReturnValue({ ids: '0,-5' });
      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('rejects more than 600 ids', async () => {
      const many = Array.from({ length: 601 }, (_, i) => i + 1).join(',');
      vi.mocked(getQuery).mockReturnValue({ ids: many });
      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('sets public cache header for anonymous requests', async () => {
      vi.mocked(getQuery).mockReturnValue({ ids: '1069' });
      vi.mocked(optionalAuth).mockResolvedValue(null);
      mockGraphqlQuery.mockResolvedValue({
        products: { products: [], count: 0 },
      });

      await handler(fakeEvent);

      expect(setResponseHeader).toHaveBeenCalledWith(
        fakeEvent,
        'Cache-Control',
        'public, s-maxage=60, stale-while-revalidate=600',
      );
    });

    it('sets private cache header for authenticated requests', async () => {
      vi.mocked(getQuery).mockReturnValue({ ids: '1069' });
      vi.mocked(optionalAuth).mockResolvedValue({ authToken: 'tok' });
      mockGraphqlQuery.mockResolvedValue({
        products: { products: [], count: 0 },
      });

      await handler(fakeEvent);

      expect(setResponseHeader).toHaveBeenCalledWith(
        fakeEvent,
        'Cache-Control',
        'private, no-cache',
      );

      vi.mocked(optionalAuth).mockResolvedValue(null);
    });
  });
});
