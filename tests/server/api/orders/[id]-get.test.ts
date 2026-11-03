import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock auth
const mockRequireAuth = vi.fn();
const mockOptionalAuth = vi.fn();
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  optionalAuth: (...args: unknown[]) => mockOptionalAuth(...args),
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
const mockedGetRouterParam = vi.mocked(getRouterParam);

/** An event on a tenant with the given orderPlacement rule; none stored when absent. */
function eventWith(access?: 'all' | 'authenticated'): H3Event {
  const features = access ? { orderPlacement: { enabled: true, access } } : {};
  return {
    context: { tenant: { hostname: 'test.com', config: { features } } },
  } as unknown as H3Event;
}

describe('GET /api/orders/[id]', () => {
  // No orderPlacement rule stored: the session is required, as before.
  const mockEvent = eventWith();

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

  it('serves a signed-out buyer when orderPlacement access is all', async () => {
    mockOptionalAuth.mockResolvedValueOnce(null);
    mockedGetRouterParam.mockReturnValueOnce('abc-123');
    mockGetOrder.mockResolvedValueOnce({ id: 1, publicId: 'abc-123' });
    const event = eventWith('all');

    await expect(handler(event)).resolves.toEqual({
      order: { id: 1, publicId: 'abc-123' },
    });
    expect(mockRequireAuth).not.toHaveBeenCalled();
    expect(mockGetOrder).toHaveBeenCalledWith(
      { publicOrderId: 'abc-123' },
      event,
    );
  });

  it('answers 401 to a signed-out request when orderPlacement access is authenticated', async () => {
    const authError = Object.assign(new Error('Authentication required'), {
      statusCode: 401,
    });
    mockRequireAuth.mockRejectedValueOnce(authError);

    await expect(handler(eventWith('authenticated'))).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mockOptionalAuth).not.toHaveBeenCalled();
    expect(mockGetOrder).not.toHaveBeenCalled();
  });

  it('answers 401 to a signed-out request when the tenant stores no orderPlacement rule', async () => {
    const authError = Object.assign(new Error('Authentication required'), {
      statusCode: 401,
    });
    mockRequireAuth.mockRejectedValueOnce(authError);

    await expect(handler(eventWith())).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mockOptionalAuth).not.toHaveBeenCalled();
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
    expect(mockedGetRouterParam).toHaveBeenCalledWith(mockEvent, 'id');
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
    expect(setResponseHeader).not.toHaveBeenCalled();
  });

  it('marks a successful answer cacheable for thirty seconds', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    mockedGetRouterParam.mockReturnValueOnce('abc-123');
    mockGetOrder.mockResolvedValueOnce({ id: 1, publicId: 'abc-123' });

    await handler(mockEvent);

    expect(setResponseHeader).toHaveBeenCalledWith(
      mockEvent,
      'Cache-Control',
      'private, max-age=30, must-revalidate',
    );
  });

  it('names the operation for the error log', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    mockedGetRouterParam.mockReturnValueOnce('abc-123');
    mockGetOrder.mockResolvedValueOnce({ id: 1, publicId: 'abc-123' });

    await handler(mockEvent);

    expect(withErrorHandling).toHaveBeenCalledWith(expect.any(Function), {
      operation: 'orders.get',
    });
  });

  // A cacheable error would be served again to the page's retry.
  it('leaves a failed answer without a cache header', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    mockedGetRouterParam.mockReturnValueOnce('abc-123');
    mockGetOrder.mockRejectedValueOnce(new Error('SDK failure'));

    await expect(handler(mockEvent)).rejects.toThrow('SDK failure');
    expect(setResponseHeader).not.toHaveBeenCalled();
  });

  it('leaves a not-found answer without a cache header', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    mockedGetRouterParam.mockReturnValueOnce('nonexistent');
    mockGetOrder.mockResolvedValueOnce(undefined);

    await expect(handler(mockEvent)).rejects.toThrow('Order not found');
    expect(setResponseHeader).not.toHaveBeenCalled();
  });
});
