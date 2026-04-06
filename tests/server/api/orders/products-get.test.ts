import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock auth
const mockRequireAuth = vi.fn();
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// Mock purchased products service
const mockGetPurchasedProducts = vi.fn();
vi.mock('../../../../server/services/purchased-products', () => ({
  getPurchasedProducts: (...args: unknown[]) =>
    mockGetPurchasedProducts(...args),
}));

// Stub auto-imports
vi.stubGlobal(
  'withErrorHandling',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, message: string) => {
    const err = new Error(message) as Error & {
      statusCode: number;
      statusMessage: string;
    };
    err.statusCode = code === 'UNAUTHORIZED' ? 401 : 500;
    err.statusMessage = message;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);

let handler: (event: H3Event) => Promise<unknown>;

describe('GET /api/orders/products', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = (await import('../../../../server/api/orders/products.get'))
      .default as unknown as (event: H3Event) => Promise<unknown>;
  });

  it('returns 401 when not authenticated', async () => {
    const authError = new Error('Authentication required') as Error & {
      statusCode: number;
    };
    authError.statusCode = 401;
    mockRequireAuth.mockRejectedValueOnce(authError);

    await expect(handler(mockEvent)).rejects.toThrow('Authentication required');
    expect(mockGetPurchasedProducts).not.toHaveBeenCalled();
  });

  it('returns purchased products on success', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      authToken: 'test-token',
      refreshToken: 'refresh',
    });
    const productsResult = {
      products: [
        {
          name: 'Widget',
          articleNumber: 'ART-001',
          priceExVat: 100,
          totalQuantity: 5,
          latestOrderDate: '2026-01-01',
          latestOrderId: '1',
          latestBuyerName: 'John Doe',
        },
      ],
      total: 1,
    };
    mockGetPurchasedProducts.mockResolvedValueOnce(productsResult);

    const result = await handler(mockEvent);

    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockGetPurchasedProducts).toHaveBeenCalledWith(
      'test-token',
      mockEvent,
    );
    expect(result).toEqual(productsResult);
  });

  it('handles service errors gracefully', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      authToken: 'test-token',
      refreshToken: 'refresh',
    });
    mockGetPurchasedProducts.mockRejectedValueOnce(new Error('SDK failure'));

    await expect(handler(mockEvent)).rejects.toThrow('SDK failure');
  });
});
