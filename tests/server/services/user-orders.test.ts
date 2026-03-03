import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock the SDK module
const mockOrdersGet = vi.fn();

const mockSDK = {
  crm: {
    user: {
      orders: {
        get: mockOrdersGet,
      },
    },
  },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
}));

// Mock auto-imported wrapServiceCall
vi.stubGlobal(
  'wrapServiceCall',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);

// Mock ErrorCode and AuthError (auto-imports used in user.ts)
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
});

let user: typeof import('../../../server/services/user');

describe('getUserOrders', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    user = await import('../../../server/services/user');
  });

  it('calls crm.user.orders.get with userToken', async () => {
    const mockOrders = { getOrders: [{ id: 1, status: 'placed' }] };
    mockOrdersGet.mockResolvedValueOnce(mockOrders);

    const result = await user.getUserOrders('test-token', mockEvent);

    expect(mockOrdersGet).toHaveBeenCalledWith('test-token');
    expect(result).toEqual(mockOrders);
  });

  it('returns undefined when SDK returns undefined', async () => {
    mockOrdersGet.mockResolvedValueOnce(undefined);

    const result = await user.getUserOrders('test-token', mockEvent);

    expect(result).toBeUndefined();
  });
});
