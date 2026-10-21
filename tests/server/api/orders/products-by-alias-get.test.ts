import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

const mockRequireAuth = vi.fn();
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockGetPurchasedProducts = vi.fn();
vi.mock('../../../../server/services/purchased-products', () => ({
  getPurchasedProducts: (...args: unknown[]) =>
    mockGetPurchasedProducts(...args),
}));

vi.stubGlobal(
  'withErrorHandling',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);
vi.stubGlobal('getRouterParam', vi.fn());
vi.stubGlobal('setResponseHeader', vi.fn());

let handler: (event: H3Event) => Promise<unknown>;

describe('GET /api/orders/products/by-alias/[alias]', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ authToken: 'test-token' });
    vi.mocked(getRouterParam).mockReturnValue('widget');
    handler = (
      await import('../../../../server/api/orders/products/by-alias/[alias].get')
    ).default as unknown as (event: H3Event) => Promise<unknown>;
  });

  it('returns the purchased product matching the alias', async () => {
    const widget = { alias: 'widget', name: 'Widget' };
    mockGetPurchasedProducts.mockResolvedValueOnce({
      products: [{ alias: 'other', name: 'Other' }, widget],
      total: 2,
    });

    expect(await handler(mockEvent)).toEqual({ product: widget });
    expect(getRouterParam).toHaveBeenCalledWith(mockEvent, 'alias');
  });

  it('returns null when the alias was never ordered', async () => {
    mockGetPurchasedProducts.mockResolvedValueOnce({
      products: [{ alias: 'other', name: 'Other' }],
      total: 1,
    });

    expect(await handler(mockEvent)).toEqual({ product: null });
  });

  it('marks a successful answer cacheable for five minutes', async () => {
    mockGetPurchasedProducts.mockResolvedValueOnce({ products: [], total: 0 });

    await handler(mockEvent);

    expect(setResponseHeader).toHaveBeenCalledWith(
      mockEvent,
      'Cache-Control',
      'private, max-age=300, must-revalidate',
    );
  });

  it('names the operation for the error log', async () => {
    mockGetPurchasedProducts.mockResolvedValueOnce({ products: [], total: 0 });

    await handler(mockEvent);

    expect(withErrorHandling).toHaveBeenCalledWith(expect.any(Function), {
      operation: 'orders.products.byAlias',
    });
  });

  // A cacheable error would be served again on the next product page visit.
  it('leaves a failed answer without a cache header', async () => {
    mockGetPurchasedProducts.mockRejectedValueOnce(new Error('SDK failure'));

    await expect(handler(mockEvent)).rejects.toThrow('SDK failure');
    expect(setResponseHeader).not.toHaveBeenCalled();
  });

  it('rejects a missing alias without a cache header', async () => {
    vi.mocked(getRouterParam).mockReturnValueOnce(undefined);

    await expect(handler(mockEvent)).rejects.toThrow();
    expect(mockGetPurchasedProducts).not.toHaveBeenCalled();
    expect(setResponseHeader).not.toHaveBeenCalled();
  });
});
