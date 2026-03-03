import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

const mockGetUserOrders = vi.fn();
vi.mock('../../../../server/services/user', () => ({
  getUserOrders: (...args: unknown[]) => mockGetUserOrders(...args),
}));

const mockRequireAuth = vi.fn().mockResolvedValue({
  authToken: 'test-auth-token',
  refreshToken: 'test-refresh-token',
});
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
});

describe('GET /api/user/orders', () => {
  const mockEvent = {} as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      authToken: 'test-auth-token',
      refreshToken: 'test-refresh-token',
    });
  });

  it('returns orders on success', async () => {
    const mockOrders = {
      getOrders: [{ id: 1, status: 'placed', createdAt: '2026-01-01' }],
    };
    mockGetUserOrders.mockResolvedValue(mockOrders);

    const handler = (await import('../../../../server/api/user/orders.get'))
      .default;
    const result = await handler(mockEvent);

    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockGetUserOrders).toHaveBeenCalledWith(
      'test-auth-token',
      mockEvent,
    );
    expect(result).toEqual({ orders: mockOrders.getOrders });
  });

  it('returns empty array when no orders', async () => {
    mockGetUserOrders.mockResolvedValue(undefined);

    const handler = (await import('../../../../server/api/user/orders.get'))
      .default;
    const result = await handler(mockEvent);

    expect(result).toEqual({ orders: [] });
  });
});
