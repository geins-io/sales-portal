import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';
import type { H3Event } from 'h3';

// =============================================================================
// Mock Setup
// =============================================================================

const mockGetProducts = vi.fn();
const mockGetFilters = vi.fn();
const mockGetCategoryPage = vi.fn();
const mockGetBrandPage = vi.fn();

vi.mock('../../../server/services/product-lists', () => ({
  getProducts: (...args: unknown[]) => mockGetProducts(...args),
  getFilters: (...args: unknown[]) => mockGetFilters(...args),
  getCategoryPage: (...args: unknown[]) => mockGetCategoryPage(...args),
  getBrandPage: (...args: unknown[]) => mockGetBrandPage(...args),
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
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);

// =============================================================================
// Helpers
// =============================================================================

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

// =============================================================================
// Tests
// =============================================================================

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

    it('should call getProducts with validated query', async () => {
      const query = { skip: '0', take: '10', categoryAlias: 'shoes' };
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue(query);
      mockGetProducts.mockResolvedValue({ products: [] });

      const event = createMockEvent();
      const result = await handler(event);

      expect(mockGetProducts).toHaveBeenCalledWith(
        { skip: 0, take: 10, categoryAlias: 'shoes' },
        event,
      );
      expect(result).toEqual({ products: [] });
    });

    it('should accept empty query (all optional)', async () => {
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({});
      mockGetProducts.mockResolvedValue({ products: [] });

      const event = createMockEvent();
      await handler(event);

      expect(mockGetProducts).toHaveBeenCalledWith({}, event);
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

    it('should call getFilters with validated query', async () => {
      const query = { brandAlias: 'nike' };
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue(query);
      mockGetFilters.mockResolvedValue({ filters: [] });

      const event = createMockEvent();
      const result = await handler(event);

      expect(mockGetFilters).toHaveBeenCalledWith(
        { brandAlias: 'nike' },
        event,
      );
      expect(result).toEqual({ filters: [] });
    });

    it('should accept empty query', async () => {
      (getQuery as ReturnType<typeof vi.fn>).mockReturnValue({});
      mockGetFilters.mockResolvedValue({ filters: [] });

      const event = createMockEvent();
      await handler(event);

      expect(mockGetFilters).toHaveBeenCalledWith({}, event);
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

    it('should call getCategoryPage with validated alias', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue('shoes');
      mockGetCategoryPage.mockResolvedValue({ name: 'Shoes' });

      const event = createMockEvent();
      const result = await handler(event);

      expect(mockGetCategoryPage).toHaveBeenCalledWith(
        { alias: 'shoes' },
        event,
      );
      expect(result).toEqual({ name: 'Shoes' });
    });

    it('should throw NOT_FOUND when getCategoryPage returns null', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue(
        'non-existent',
      );
      mockGetCategoryPage.mockResolvedValue(null);

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

    it('should call getBrandPage with validated alias', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue('nike');
      mockGetBrandPage.mockResolvedValue({ name: 'Nike' });

      const event = createMockEvent();
      const result = await handler(event);

      expect(mockGetBrandPage).toHaveBeenCalledWith({ alias: 'nike' }, event);
      expect(result).toEqual({ name: 'Nike' });
    });

    it('should throw NOT_FOUND when getBrandPage returns null', async () => {
      (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue(
        'non-existent',
      );
      mockGetBrandPage.mockResolvedValue(null);

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
