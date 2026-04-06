import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock auth
const mockRequireAuth = vi.fn();
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// Mock orders service
const mockGetOrder = vi.fn();
vi.mock('../../../../server/services/orders', () => ({
  getOrder: (...args: unknown[]) => mockGetOrder(...args),
  listOrders: vi.fn(),
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
    err.statusCode =
      code === 'UNAUTHORIZED'
        ? 401
        : code === 'NOT_FOUND'
          ? 404
          : code === 'BAD_REQUEST'
            ? 400
            : 500;
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
vi.stubGlobal('getRouterParam', vi.fn());
vi.stubGlobal('setResponseHeader', vi.fn());

let handler: (event: H3Event) => Promise<unknown>;

// Access the mocked getRouterParam
const mockedGetRouterParam = globalThis.getRouterParam as ReturnType<
  typeof vi.fn
>;

describe('GET /api/orders/[id]', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = (await import('../../../../server/api/orders/[id].get'))
      .default as unknown as (event: H3Event) => Promise<unknown>;
  });

  it('returns 401 when not authenticated', async () => {
    const authError = new Error('Authentication required') as Error & {
      statusCode: number;
    };
    authError.statusCode = 401;
    mockRequireAuth.mockRejectedValueOnce(authError);

    await expect(handler(mockEvent)).rejects.toThrow('Authentication required');
    expect(mockGetOrder).not.toHaveBeenCalled();
  });

  it('returns order detail on success', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      authToken: 'test-token',
      refreshToken: 'refresh',
    });
    mockedGetRouterParam.mockReturnValueOnce('abc-123');

    const orderData = {
      id: 1,
      publicId: 'abc-123',
      status: 'Placed',
      createdAt: '2026-01-01',
    };
    mockGetOrder.mockResolvedValueOnce(orderData);

    const result = await handler(mockEvent);

    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockGetOrder).toHaveBeenCalledWith(
      { publicOrderId: 'abc-123' },
      mockEvent,
    );
    expect(result).toEqual({ order: orderData });
  });

  it('returns 404 when order not found', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      authToken: 'test-token',
      refreshToken: 'refresh',
    });
    mockedGetRouterParam.mockReturnValueOnce('nonexistent');
    mockGetOrder.mockResolvedValueOnce(undefined);

    await expect(handler(mockEvent)).rejects.toThrow('Order not found');
  });

  it('throws BAD_REQUEST when id param is missing', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      authToken: 'test-token',
      refreshToken: 'refresh',
    });
    mockedGetRouterParam.mockReturnValueOnce(undefined);

    await expect(handler(mockEvent)).rejects.toThrow();
  });
});
