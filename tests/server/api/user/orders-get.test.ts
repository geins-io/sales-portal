import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let user service run for real
// ---------------------------------------------------------------------------
const mockUserOrdersGet = vi.fn();

const mockSDK = {
  crm: {
    user: {
      orders: {
        get: mockUserOrdersGet,
      },
    },
  },
};

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
}));

// requireAuth reads cookies — must stay mocked
const mockRequireAuth = vi.fn().mockResolvedValue({
  authToken: 'test-auth-token',
  refreshToken: 'test-refresh-token',
});
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.stubGlobal('setResponseHeader', vi.fn());
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
});
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

describe('GET /api/user/orders', () => {
  const mockEvent = {} as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      authToken: 'test-auth-token',
      refreshToken: 'test-refresh-token',
    });
  });

  it('returns orders from SDK', async () => {
    const mockOrders = {
      getOrders: [{ id: 1, status: 'placed', createdAt: '2026-01-01' }],
    };
    mockUserOrdersGet.mockResolvedValue(mockOrders);

    const handler = (await import('../../../../server/api/user/orders.get'))
      .default;
    const result = await handler(mockEvent);

    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockUserOrdersGet).toHaveBeenCalledWith('test-auth-token');
    expect(result).toEqual({ orders: mockOrders.getOrders });
  });

  it('returns empty array when SDK returns undefined', async () => {
    mockUserOrdersGet.mockResolvedValue(undefined);

    const handler = (await import('../../../../server/api/user/orders.get'))
      .default;
    const result = await handler(mockEvent);

    expect(result).toEqual({ orders: [] });
  });
});
