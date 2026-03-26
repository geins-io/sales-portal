import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let cart service functions run for real
// ---------------------------------------------------------------------------
const mockCartGet = vi.fn();
const mockCartCreate = vi.fn();
const mockCartAddItem = vi.fn();
const mockCartUpdateItem = vi.fn();
const mockCartDeleteItem = vi.fn();
const mockCartSetPromotionCode = vi.fn();
const mockCartRemovePromotionCode = vi.fn();

const mockSDK = {
  oms: {
    cart: {
      get: mockCartGet,
      create: mockCartCreate,
      addItem: mockCartAddItem,
      updateItem: mockCartUpdateItem,
      deleteItem: mockCartDeleteItem,
      setPromotionCode: mockCartSetPromotionCode,
      removePromotionCode: mockCartRemovePromotionCode,
    },
  },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
}));

// ---------------------------------------------------------------------------
// Stub Nitro / h3 auto-imports
// ---------------------------------------------------------------------------
// eslint-friendly callable type
type AnyFn = (...args: unknown[]) => unknown;

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
vi.stubGlobal(
  'getValidatedQuery',
  vi.fn(async (_event: unknown, validator: (raw: unknown) => unknown) => {
    const query = (getQuery as ReturnType<typeof vi.fn>)(_event);
    return validator(query);
  }),
);
vi.stubGlobal('readValidatedBody', vi.fn());
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

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
    it('returns cart data from SDK', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ cartId: 'cart-123' });
      mockCartGet.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/index.get'))
        .default;
      const result = await handler(mockEvent);

      expect(mockCartGet).toHaveBeenCalledWith('cart-123');
      expect(result).toEqual(mockCart);
    });

    it('throws NOT_FOUND when SDK returns null', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ cartId: 'missing-cart' });
      mockCartGet.mockResolvedValue(null);

      const handler = (await import('../../../server/api/cart/index.get'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow('Cart not found');
    });

    it('returns null when cartId is absent (first-visit users)', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({});

      const handler = (await import('../../../server/api/cart/index.get'))
        .default;
      const result = await handler(mockEvent);

      expect(result).toBeNull();
      expect(mockCartGet).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/cart', () => {
    it('creates cart via SDK and returns result', async () => {
      mockCartCreate.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/index.post'))
        .default;
      const result = await handler(mockEvent);

      expect(mockCartCreate).toHaveBeenCalled();
      expect(result).toEqual(mockCart);
    });
  });

  describe('POST /api/cart/items', () => {
    it('adds item via SDK with cartId, skuId, and quantity', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({
          cartId: 'cart-123',
          skuId: 456,
          quantity: 2,
        });
      });
      mockCartAddItem.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/items.post'))
        .default;
      const result = await handler(mockEvent);

      expect(mockCartAddItem).toHaveBeenCalledWith('cart-123', {
        skuId: 456,
        quantity: 2,
      });
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
    it('updates item via SDK with cartId, itemId, and quantity', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({
          cartId: 'cart-123',
          itemId: 'item-789',
          quantity: 5,
        });
      });
      mockCartUpdateItem.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/items.put'))
        .default;
      const result = await handler(mockEvent);

      expect(mockCartUpdateItem).toHaveBeenCalledWith('cart-123', {
        id: 'item-789',
        quantity: 5,
      });
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
    it('deletes item via SDK with cartId and itemId', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ cartId: 'cart-123', itemId: 'item-789' });
      mockCartDeleteItem.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/items.delete'))
        .default;
      const result = await handler(mockEvent);

      expect(mockCartDeleteItem).toHaveBeenCalledWith('cart-123', 'item-789');
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
    it('applies promo code via SDK', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({
          cartId: 'cart-123',
          promoCode: 'SAVE10',
        });
      });
      mockCartSetPromotionCode.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/promo.post'))
        .default;
      const result = await handler(mockEvent);

      expect(mockCartSetPromotionCode).toHaveBeenCalledWith(
        'cart-123',
        'SAVE10',
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
    it('removes promo code via SDK', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ cartId: 'cart-123' });
      mockCartRemovePromotionCode.mockResolvedValue(mockCart);

      const handler = (await import('../../../server/api/cart/promo.delete'))
        .default;
      const result = await handler(mockEvent);

      expect(mockCartRemovePromotionCode).toHaveBeenCalledWith('cart-123');
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
