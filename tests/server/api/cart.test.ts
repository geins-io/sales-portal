import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-friendly callable type
type AnyFn = (...args: unknown[]) => unknown;

const mockGetCart = vi.fn();
const mockCreateCart = vi.fn();
const mockAddItem = vi.fn();
const mockUpdateItem = vi.fn();
const mockDeleteItem = vi.fn();
const mockApplyPromoCode = vi.fn();
const mockRemovePromoCode = vi.fn();

vi.mock('../../../server/services/cart', () => ({
  getCart: (...args: unknown[]) => mockGetCart(...args),
  createCart: (...args: unknown[]) => mockCreateCart(...args),
  addItem: (...args: unknown[]) => mockAddItem(...args),
  updateItem: (...args: unknown[]) => mockUpdateItem(...args),
  deleteItem: (...args: unknown[]) => mockDeleteItem(...args),
  applyPromoCode: (...args: unknown[]) => mockApplyPromoCode(...args),
  removePromoCode: (...args: unknown[]) => mockRemovePromoCode(...args),
}));

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
vi.stubGlobal('readValidatedBody', vi.fn());
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);

const mockEvent = {
  context: {
    tenant: { hostname: 'test.example.com', tenantId: 'test-tenant' },
  },
  node: { req: { headers: {} } },
} as unknown as import('h3').H3Event;

const mockCart = {
  id: 'cart-123',
  items: [],
  summary: { total: { sellingPriceIncVat: 0 } },
};

describe('Cart API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/cart', () => {
    it('calls getCart with cartId from query', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ cartId: 'cart-123' });
      mockGetCart.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/index.get'))
        .default;
      const result = await handler(mockEvent);

      expect(mockGetCart).toHaveBeenCalledWith('cart-123', mockEvent);
      expect(result).toEqual(mockCart);
    });

    it('throws NOT_FOUND when cart is null', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ cartId: 'missing-cart' });
      mockGetCart.mockResolvedValue(null);

      const handler = (await import('../../../server/api/cart/index.get'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow('Cart not found');
    });

    it('throws on invalid query (missing cartId)', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({});

      const handler = (await import('../../../server/api/cart/index.get'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow();
    });
  });

  describe('POST /api/cart', () => {
    it('calls createCart with event', async () => {
      mockCreateCart.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/index.post'))
        .default;
      const result = await handler(mockEvent);

      expect(mockCreateCart).toHaveBeenCalledWith(mockEvent);
      expect(result).toEqual(mockCart);
    });
  });

  describe('POST /api/cart/items', () => {
    it('calls addItem with cartId, skuId, and quantity', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({
          cartId: 'cart-123',
          skuId: 456,
          quantity: 2,
        });
      });
      mockAddItem.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/items.post'))
        .default;
      const result = await handler(mockEvent);

      expect(mockAddItem).toHaveBeenCalledWith(
        'cart-123',
        { skuId: 456, quantity: 2 },
        mockEvent,
      );
      expect(result).toEqual(mockCart);
    });

    it('throws on invalid body (missing skuId)', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({ cartId: 'cart-123', quantity: 2 });
      });

      const handler = (await import('../../../server/api/cart/items.post'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow();
    });
  });

  describe('PUT /api/cart/items', () => {
    it('calls updateItem with cartId, itemId, and quantity', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({
          cartId: 'cart-123',
          itemId: 'item-789',
          quantity: 5,
        });
      });
      mockUpdateItem.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/items.put'))
        .default;
      const result = await handler(mockEvent);

      expect(mockUpdateItem).toHaveBeenCalledWith(
        'cart-123',
        { itemId: 'item-789', quantity: 5 },
        mockEvent,
      );
      expect(result).toEqual(mockCart);
    });

    it('throws on invalid body (missing itemId)', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({ cartId: 'cart-123', quantity: 3 });
      });

      const handler = (await import('../../../server/api/cart/items.put'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow();
    });
  });

  describe('DELETE /api/cart/items', () => {
    it('calls deleteItem with cartId and itemId from query', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ cartId: 'cart-123', itemId: 'item-789' });
      mockDeleteItem.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/items.delete'))
        .default;
      const result = await handler(mockEvent);

      expect(mockDeleteItem).toHaveBeenCalledWith(
        'cart-123',
        'item-789',
        mockEvent,
      );
      expect(result).toEqual(mockCart);
    });

    it('throws on invalid query (missing itemId)', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ cartId: 'cart-123' });

      const handler = (await import('../../../server/api/cart/items.delete'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow();
    });
  });

  describe('POST /api/cart/promo', () => {
    it('calls applyPromoCode with cartId and promoCode', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({
          cartId: 'cart-123',
          promoCode: 'SAVE10',
        });
      });
      mockApplyPromoCode.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/promo.post'))
        .default;
      const result = await handler(mockEvent);

      expect(mockApplyPromoCode).toHaveBeenCalledWith(
        'cart-123',
        'SAVE10',
        mockEvent,
      );
      expect(result).toEqual(mockCart);
    });

    it('throws on invalid body (missing promoCode)', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({ cartId: 'cart-123' });
      });

      const handler = (await import('../../../server/api/cart/promo.post'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow();
    });
  });

  describe('DELETE /api/cart/promo', () => {
    it('calls removePromoCode with cartId from query', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ cartId: 'cart-123' });
      mockRemovePromoCode.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/promo.delete'))
        .default;
      const result = await handler(mockEvent);

      expect(mockRemovePromoCode).toHaveBeenCalledWith('cart-123', mockEvent);
      expect(result).toEqual(mockCart);
    });

    it('throws on invalid query (missing cartId)', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({});

      const handler = (await import('../../../server/api/cart/promo.delete'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow();
    });
  });
});
