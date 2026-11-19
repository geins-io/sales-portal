import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

const mockRequireAuth = vi.fn();
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockGetOrderOverview = vi.fn();
vi.mock('../../../../server/services/orders', () => ({
  getOrderOverview: (...args: unknown[]) => mockGetOrderOverview(...args),
}));

vi.stubGlobal(
  'withErrorHandling',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);
vi.stubGlobal('setResponseHeader', vi.fn());

let handler: (event: H3Event) => Promise<unknown>;

describe('GET /api/orders/overview', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = (await import('../../../../server/api/orders/overview.get'))
      .default as unknown as (event: H3Event) => Promise<unknown>;
  });

  it('reads nothing for a visitor who is not signed in', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error('Authentication required'));

    await expect(handler(mockEvent)).rejects.toThrow('Authentication required');
    expect(mockGetOrderOverview).not.toHaveBeenCalled();
  });

  it("answers the start page's newest orders and their count", async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    const overview = {
      orders: [{ id: 1216, status: 'Placed', publicId: 'p' }],
      total: 103,
    };
    mockGetOrderOverview.mockResolvedValueOnce(overview);

    expect(await handler(mockEvent)).toEqual(overview);
    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockGetOrderOverview).toHaveBeenCalledWith(mockEvent);
    expect(withErrorHandling).toHaveBeenCalledWith(expect.any(Function), {
      operation: 'orders.overview',
    });
  });

  it('marks a successful answer cacheable for thirty seconds, as the list', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    mockGetOrderOverview.mockResolvedValueOnce({ orders: [], total: 0 });

    await handler(mockEvent);

    expect(setResponseHeader).toHaveBeenCalledWith(
      mockEvent,
      'Cache-Control',
      'private, max-age=30, must-revalidate',
    );
  });

  it('leaves a failed answer without a cache header', async () => {
    mockRequireAuth.mockResolvedValueOnce({ authToken: 'test-token' });
    mockGetOrderOverview.mockRejectedValueOnce(new Error('Geins 502'));

    await expect(handler(mockEvent)).rejects.toThrow('Geins 502');
    expect(setResponseHeader).not.toHaveBeenCalled();
  });
});
