import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the products service module
// ---------------------------------------------------------------------------
const mockGetProduct = vi.fn();
const mockGetRelatedProducts = vi.fn();
const mockGetReviews = vi.fn();
const mockGetPriceHistory = vi.fn();
const mockPostReview = vi.fn();
const mockMonitorAvailability = vi.fn();

vi.mock('../../../server/services/products', () => ({
  getProduct: (...args: unknown[]) => mockGetProduct(...args),
  getRelatedProducts: (...args: unknown[]) => mockGetRelatedProducts(...args),
  getReviews: (...args: unknown[]) => mockGetReviews(...args),
  getPriceHistory: (...args: unknown[]) => mockGetPriceHistory(...args),
  postReview: (...args: unknown[]) => mockPostReview(...args),
  monitorAvailability: (...args: unknown[]) => mockMonitorAvailability(...args),
}));

// ---------------------------------------------------------------------------
// Stub Nitro / h3 auto-imports
// ---------------------------------------------------------------------------
vi.stubGlobal(
  'withErrorHandling',
  async (fn: () => Promise<unknown>) => fn(),
);
vi.stubGlobal(
  'createAppError',
  vi.fn((_code: string, msg: string) => {
    const err = new Error(msg);
    (err as any).statusCode = 404;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', { NOT_FOUND: 'NOT_FOUND' });
vi.stubGlobal('getRouterParam', vi.fn());
vi.stubGlobal('getQuery', vi.fn());
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal('defineEventHandler', (fn: Function) => fn);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fakeEvent = {} as any;

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
    let handler: (event: any) => Promise<unknown>;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import(
        '../../../server/api/products/[alias].get.ts'
      );
      handler = mod.default as any;
    });

    it('calls getProduct with validated alias', async () => {
      (getRouterParam as any).mockReturnValue('my-product');
      mockGetProduct.mockResolvedValue({ id: 1, name: 'My Product' });

      const result = await handler(fakeEvent);

      expect(mockGetProduct).toHaveBeenCalledWith(
        { alias: 'my-product' },
        fakeEvent,
      );
      expect(result).toEqual({ id: 1, name: 'My Product' });
    });

    it('throws NOT_FOUND when service returns null', async () => {
      (getRouterParam as any).mockReturnValue('missing');
      mockGetProduct.mockResolvedValue(null);

      await expect(handler(fakeEvent)).rejects.toThrow('Product not found');
    });

    it('throws ZodError for empty alias', async () => {
      (getRouterParam as any).mockReturnValue('');

      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('throws ZodError for missing alias', async () => {
      (getRouterParam as any).mockReturnValue(undefined);

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // GET /api/products/[alias]/related
  // =======================================================================
  describe('GET /api/products/[alias]/related', () => {
    let handler: (event: any) => Promise<unknown>;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import(
        '../../../server/api/products/[alias]/related.get.ts'
      );
      handler = mod.default as any;
    });

    it('calls getRelatedProducts with validated alias', async () => {
      (getRouterParam as any).mockReturnValue('my-product');
      mockGetRelatedProducts.mockResolvedValue([{ id: 2 }]);

      const result = await handler(fakeEvent);

      expect(mockGetRelatedProducts).toHaveBeenCalledWith(
        { alias: 'my-product' },
        fakeEvent,
      );
      expect(result).toEqual([{ id: 2 }]);
    });

    it('throws ZodError for empty alias', async () => {
      (getRouterParam as any).mockReturnValue('');

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // GET /api/products/[alias]/reviews
  // =======================================================================
  describe('GET /api/products/[alias]/reviews', () => {
    let handler: (event: any) => Promise<unknown>;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import(
        '../../../server/api/products/[alias]/reviews.get.ts'
      );
      handler = mod.default as any;
    });

    it('calls getReviews with alias and pagination', async () => {
      (getRouterParam as any).mockReturnValue('my-product');
      (getQuery as any).mockReturnValue({ skip: '0', take: '10' });
      mockGetReviews.mockResolvedValue({ items: [] });

      const result = await handler(fakeEvent);

      expect(mockGetReviews).toHaveBeenCalledWith(
        { alias: 'my-product', skip: 0, take: 10 },
        fakeEvent,
      );
      expect(result).toEqual({ items: [] });
    });

    it('works without optional query params', async () => {
      (getRouterParam as any).mockReturnValue('my-product');
      (getQuery as any).mockReturnValue({});
      mockGetReviews.mockResolvedValue({ items: [] });

      await handler(fakeEvent);

      expect(mockGetReviews).toHaveBeenCalledWith(
        { alias: 'my-product' },
        fakeEvent,
      );
    });

    it('throws ZodError for invalid take value', async () => {
      (getRouterParam as any).mockReturnValue('my-product');
      (getQuery as any).mockReturnValue({ take: '999' });

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // POST /api/products/[alias]/reviews
  // =======================================================================
  describe('POST /api/products/[alias]/reviews', () => {
    let handler: (event: any) => Promise<unknown>;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import(
        '../../../server/api/products/[alias]/reviews.post.ts'
      );
      handler = mod.default as any;
    });

    it('calls postReview with alias + body', async () => {
      (getRouterParam as any).mockReturnValue('my-product');
      (readBody as any).mockResolvedValue({
        rating: 5,
        author: 'Alice',
        comment: 'Great!',
      });
      mockPostReview.mockResolvedValue({ ok: true });

      const result = await handler(fakeEvent);

      expect(mockPostReview).toHaveBeenCalledWith(
        {
          alias: 'my-product',
          rating: 5,
          author: 'Alice',
          comment: 'Great!',
        },
        fakeEvent,
      );
      expect(result).toEqual({ ok: true });
    });

    it('works without optional comment', async () => {
      (getRouterParam as any).mockReturnValue('my-product');
      (readBody as any).mockResolvedValue({
        rating: 3,
        author: 'Bob',
      });
      mockPostReview.mockResolvedValue({ ok: true });

      await handler(fakeEvent);

      expect(mockPostReview).toHaveBeenCalledWith(
        { alias: 'my-product', rating: 3, author: 'Bob' },
        fakeEvent,
      );
    });

    it('throws ZodError for missing rating', async () => {
      (getRouterParam as any).mockReturnValue('my-product');
      (readBody as any).mockResolvedValue({ author: 'Alice' });

      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('throws ZodError for rating out of range', async () => {
      (getRouterParam as any).mockReturnValue('my-product');
      (readBody as any).mockResolvedValue({
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
    let handler: (event: any) => Promise<unknown>;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import(
        '../../../server/api/products/[alias]/price-history.get.ts'
      );
      handler = mod.default as any;
    });

    it('calls getPriceHistory with validated alias', async () => {
      (getRouterParam as any).mockReturnValue('my-product');
      mockGetPriceHistory.mockResolvedValue([{ price: 100, date: '2026-01-01' }]);

      const result = await handler(fakeEvent);

      expect(mockGetPriceHistory).toHaveBeenCalledWith(
        { alias: 'my-product' },
        fakeEvent,
      );
      expect(result).toEqual([{ price: 100, date: '2026-01-01' }]);
    });

    it('throws ZodError for empty alias', async () => {
      (getRouterParam as any).mockReturnValue('');

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });

  // =======================================================================
  // POST /api/products/monitor-availability
  // =======================================================================
  describe('POST /api/products/monitor-availability', () => {
    let handler: (event: any) => Promise<unknown>;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import(
        '../../../server/api/products/monitor-availability.post.ts'
      );
      handler = mod.default as any;
    });

    it('calls monitorAvailability with validated body', async () => {
      (readBody as any).mockResolvedValue({
        email: 'user@example.com',
        skuId: 42,
      });
      mockMonitorAvailability.mockResolvedValue({ ok: true });

      const result = await handler(fakeEvent);

      expect(mockMonitorAvailability).toHaveBeenCalledWith(
        { email: 'user@example.com', skuId: 42 },
        fakeEvent,
      );
      expect(result).toEqual({ ok: true });
    });

    it('throws ZodError for invalid email', async () => {
      (readBody as any).mockResolvedValue({
        email: 'not-an-email',
        skuId: 42,
      });

      await expect(handler(fakeEvent)).rejects.toThrow();
    });

    it('throws ZodError for missing skuId', async () => {
      (readBody as any).mockResolvedValue({
        email: 'user@example.com',
      });

      await expect(handler(fakeEvent)).rejects.toThrow();
    });
  });
});
