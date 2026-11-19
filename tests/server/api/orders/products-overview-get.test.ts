import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

const mockRequireAuth = vi.fn();
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockGetOverview = vi.fn();
vi.mock('../../../../server/services/purchased-products', () => ({
  getPurchasedProductsOverview: (...args: unknown[]) =>
    mockGetOverview(...args),
}));

vi.stubGlobal(
  'withErrorHandling',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);
vi.stubGlobal('setResponseHeader', vi.fn());

let handler: (event: H3Event) => Promise<unknown>;

const EMPTY = { products: [], total: 0, mostPurchasedName: null };

describe('GET /api/orders/products/overview', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ authToken: 'test-token' });
    handler = (
      await import('../../../../server/api/orders/products/overview.get')
    ).default as unknown as (event: H3Event) => Promise<unknown>;
  });

  it('answers the start page overview for the signed-in buyer', async () => {
    const overview = {
      products: [{ name: 'Widget', articleNumber: 'ART-001' }],
      total: 12,
      mostPurchasedName: 'Widget',
    };
    mockGetOverview.mockResolvedValueOnce(overview);

    expect(await handler(mockEvent)).toEqual(overview);
    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockGetOverview).toHaveBeenCalledWith(mockEvent);
  });

  it('asks nothing of Geins for a visitor who is not signed in', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error('Authentication required'));

    await expect(handler(mockEvent)).rejects.toThrow('Authentication required');
    expect(mockGetOverview).not.toHaveBeenCalled();
  });

  it('marks a successful answer cacheable for five minutes', async () => {
    mockGetOverview.mockResolvedValueOnce(EMPTY);

    await handler(mockEvent);

    expect(setResponseHeader).toHaveBeenCalledWith(
      mockEvent,
      'Cache-Control',
      'private, max-age=300, must-revalidate',
    );
  });

  it('names the operation for the error log', async () => {
    mockGetOverview.mockResolvedValueOnce(EMPTY);

    await handler(mockEvent);

    expect(withErrorHandling).toHaveBeenCalledWith(expect.any(Function), {
      operation: 'orders.products.overview',
    });
  });

  // A cacheable error would come back to the start page's retry.
  it('leaves a failed answer without a cache header', async () => {
    mockGetOverview.mockRejectedValueOnce(new Error('SDK failure'));

    await expect(handler(mockEvent)).rejects.toThrow('SDK failure');
    expect(setResponseHeader).not.toHaveBeenCalled();
  });
});
