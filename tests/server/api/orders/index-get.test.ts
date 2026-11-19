import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock auth
const mockRequireAuth = vi.fn();
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// Mock orders service
const mockListOrders = vi.fn();
vi.mock('../../../../server/services/orders', () => ({
  listOrders: (...args: unknown[]) => mockListOrders(...args),
  getOrder: vi.fn(),
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
vi.stubGlobal('setResponseHeader', vi.fn());
const getQueryMock = vi.fn((_event: unknown): Record<string, string> => ({}));
vi.stubGlobal(
  'getValidatedQuery',
  vi.fn(async (event: unknown, validator: (raw: unknown) => unknown) =>
    validator(getQueryMock(event)),
  ),
);

let handler: (event: H3Event) => Promise<unknown>;

describe('GET /api/orders', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = (await import('../../../../server/api/orders/index.get'))
      .default as unknown as (event: H3Event) => Promise<unknown>;
  });

  it('returns 401 when not authenticated', async () => {
    const authError = new Error('Authentication required') as Error & {
      statusCode: number;
    };
    authError.statusCode = 401;
    mockRequireAuth.mockRejectedValueOnce(authError);

    await expect(handler(mockEvent)).rejects.toThrow('Authentication required');
    expect(mockListOrders).not.toHaveBeenCalled();
  });

  it('returns orders list on success', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      authToken: 'test-token',
      refreshToken: 'refresh',
    });
    const ordersResult = {
      orders: [
        {
          id: 1,
          publicId: 'abc-123',
          status: 'Placed',
          createdAt: '2026-01-01',
          orderTotal: {
            sellingPriceIncVat: 199,
            sellingPriceIncVatFormatted: '199 kr',
          },
        },
      ],
      total: 1,
    };
    mockListOrders.mockResolvedValueOnce(ordersResult);

    const result = await handler(mockEvent);

    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockListOrders).toHaveBeenCalledWith(
      { mine: false, skip: 0, take: 20 },
      mockEvent,
    );
    expect(result).toEqual(ordersResult);
  });

  it('reads the page, the search and mine from the query', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    getQueryMock.mockReturnValueOnce({
      skip: '20',
      take: '20',
      search: ' 121 ',
      mine: 'true',
    });
    mockListOrders.mockResolvedValueOnce({ orders: [], total: 0 });

    await handler(mockEvent);

    expect(mockListOrders).toHaveBeenCalledWith(
      { mine: true, skip: 20, take: 20, search: '121' },
      mockEvent,
    );
  });

  it('refuses a take Geins would refuse, before it reads', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    getQueryMock.mockReturnValueOnce({ take: '101' });

    await expect(handler(mockEvent)).rejects.toThrow();
    expect(mockListOrders).not.toHaveBeenCalled();
  });

  it('handles service errors gracefully', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      authToken: 'test-token',
      refreshToken: 'refresh',
    });
    mockListOrders.mockRejectedValueOnce(new Error('SDK failure'));

    await expect(handler(mockEvent)).rejects.toThrow('SDK failure');
  });

  it('marks a successful answer cacheable for thirty seconds', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    mockListOrders.mockResolvedValueOnce({ orders: [], total: 0 });

    await handler(mockEvent);

    expect(setResponseHeader).toHaveBeenCalledWith(
      mockEvent,
      'Cache-Control',
      'private, max-age=30, must-revalidate',
    );
  });

  it('names the operation for the error log', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    mockListOrders.mockResolvedValueOnce({ orders: [], total: 0 });

    await handler(mockEvent);

    expect(withErrorHandling).toHaveBeenCalledWith(expect.any(Function), {
      operation: 'orders.list',
    });
  });

  // A cacheable error would be served again to the page's retry.
  it('leaves a failed answer without a cache header', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    mockListOrders.mockRejectedValueOnce(new Error('SDK failure'));

    await expect(handler(mockEvent)).rejects.toThrow('SDK failure');
    expect(setResponseHeader).not.toHaveBeenCalled();
  });
});
