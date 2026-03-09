import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let service functions run for real
// ---------------------------------------------------------------------------
const mockGraphqlQuery = vi.fn();

const mockSDK = {
  core: {
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' },
    graphql: { query: mockGraphqlQuery, mutation: vi.fn() },
  },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
}));

// Mock graphql loader (depends on #graphql-queries build-time alias)
vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
}));

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

vi.mock('../../../server/utils/logger', () => ({
  createTenantLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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
vi.stubGlobal('getRouterParam', vi.fn());
vi.stubGlobal('getQuery', vi.fn());
vi.stubGlobal(
  'getValidatedQuery',
  vi.fn(async (_event: unknown, validator: (raw: unknown) => unknown) => {
    const query = (getQuery as ReturnType<typeof vi.fn>)(_event);
    return validator(query);
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

const createMockEvent = (): H3Event =>
  ({
    node: {
      res: { setHeader: vi.fn(), statusCode: 200 },
      req: { url: '/api/product-lists', method: 'GET' },
    },
    context: {
      tenant: { id: 'test-tenant', hostname: 'test.example.com' },
    },
  }) as unknown as H3Event;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Product List API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // GET /api/product-lists/products
  // ---------------------------------------------------------------------------
  describe('GET /api/product-lists/products', () => {
    let handler: (event: H3Event) => Promise<unknown>;

    beforeEach(async () => {
      vi.resetModules();
      const mod =
        await import('../../../server/api/product-lists/products.get');
      handler = mod.default as (event: H3Event) => Promise<unknown>;
    });

    it('should return products from SDK', async () => {
      const query = { skip: '0', take: '10', categoryAlias: 'shoes' };
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue(query);
      mockGraphqlQuery.mockResolvedValue({
        products: { products: [], count: 0 },
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result).toEqual({ products: [], count: 0 });
    });

    it('should accept empty query (all optional)', async () => {
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({});
      mockGraphqlQuery.mockResolvedValue({
        products: { products: [], count: 0 },
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result).toEqual({ products: [], count: 0 });
    });

    it('should throw ZodError for invalid take value', async () => {
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({ take: '0' });

      const event = createMockEvent();
      await expect(handler(event)).rejects.toThrow(ZodError);
    });

    it('should throw ZodError for take exceeding max', async () => {
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({ take: '101' });

      const event = createMockEvent();
      await expect(handler(event)).rejects.toThrow(ZodError);
    });

    it('should throw ZodError for negative skip', async () => {
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({ skip: '-1' });

      const event = createMockEvent();
      await expect(handler(event)).rejects.toThrow(ZodError);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/product-lists/filters
  // ---------------------------------------------------------------------------
  describe('GET /api/product-lists/filters', () => {
    let handler: (event: H3Event) => Promise<unknown>;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('../../../server/api/product-lists/filters.get');
      handler = mod.default as (event: H3Event) => Promise<unknown>;
    });

    it('should return filters from SDK', async () => {
      const query = { brandAlias: 'nike' };
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue(query);
      mockGraphqlQuery.mockResolvedValue({
        filters: { filters: [], count: 5 },
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result).toEqual({ filters: [], count: 5 });
    });

    it('should accept empty query', async () => {
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({});
      mockGraphqlQuery.mockResolvedValue({
        filters: { filters: [] },
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result).toEqual({ filters: [] });
    });

    it('should throw ZodError for invalid take', async () => {
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({ take: '0' });

      const event = createMockEvent();
      await expect(handler(event)).rejects.toThrow(ZodError);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/product-lists/category/[alias]
  // ---------------------------------------------------------------------------
  describe('GET /api/product-lists/category/[alias]', () => {
    let handler: (event: H3Event) => Promise<unknown>;

    beforeEach(async () => {
      vi.resetModules();
      const mod =
        await import('../../../server/api/product-lists/category/[alias].get');
      handler = mod.default as (event: H3Event) => Promise<unknown>;
    });

    it('should return category page from SDK', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue('shoes');
      mockGraphqlQuery.mockResolvedValue({
        categoryPage: { name: 'Shoes', subCategories: [] },
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result).toEqual({ name: 'Shoes', subCategories: [] });
    });

    it('should throw NOT_FOUND when SDK returns null', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue(
        'non-existent',
      );
      mockGraphqlQuery.mockResolvedValue({ categoryPage: null });

      const event = createMockEvent();
      await expect(handler(event)).rejects.toThrow('Category page not found');
    });

    it('should throw ZodError for empty alias', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue('');

      const event = createMockEvent();
      await expect(handler(event)).rejects.toThrow(ZodError);
    });

    it('should throw ZodError for undefined alias', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const event = createMockEvent();
      await expect(handler(event)).rejects.toThrow(ZodError);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/product-lists/brand/[alias]
  // ---------------------------------------------------------------------------
  describe('GET /api/product-lists/brand/[alias]', () => {
    let handler: (event: H3Event) => Promise<unknown>;

    beforeEach(async () => {
      vi.resetModules();
      const mod =
        await import('../../../server/api/product-lists/brand/[alias].get');
      handler = mod.default as (event: H3Event) => Promise<unknown>;
    });

    it('should return brand page from SDK', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue('nike');
      mockGraphqlQuery.mockResolvedValue({
        brandPage: { name: 'Nike', id: 1 },
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result).toEqual({ name: 'Nike', id: 1 });
    });

    it('should throw NOT_FOUND when SDK returns null', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue(
        'non-existent',
      );
      mockGraphqlQuery.mockResolvedValue({ brandPage: null });

      const event = createMockEvent();
      await expect(handler(event)).rejects.toThrow('Brand page not found');
    });

    it('should throw ZodError for empty alias', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue('');

      const event = createMockEvent();
      await expect(handler(event)).rejects.toThrow(ZodError);
    });

    it('should throw ZodError for undefined alias', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const event = createMockEvent();
      await expect(handler(event)).rejects.toThrow(ZodError);
    });
  });
});
