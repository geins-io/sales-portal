import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock the SDK module
const mockOrderGet = vi.fn();
const mockGraphqlQuery = vi.fn();

const mockSDK = {
  core: {
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se', tld: 'se' },
    graphql: { query: mockGraphqlQuery },
  },
  oms: {
    order: { get: mockOrderGet },
  },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  buildRequestContext: vi.fn().mockReturnValue({
    languageId: 'sv-SE',
    marketId: 'se',
    userToken: 'test-user-token',
  }),
  getRequestChannelVariables: vi.fn().mockReturnValue({
    channelId: '1|se',
    languageId: 'sv-SE',
    marketId: 'se',
  }),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
}));
vi.mock('../../../server/services/company', () => ({
  getCompany: vi.fn().mockResolvedValue({
    buyers: [
      {
        id: 'one@example.com',
        internalId: '101',
        firstName: 'Anna',
        lastName: 'Nilsson',
      },
      {
        id: 'two@example.com',
        internalId: '202',
        firstName: 'Bea',
        lastName: 'Karlsson',
      },
    ],
  }),
}));
vi.mock('../../../server/services/graphql/unwrap', () => ({
  unwrapGraphQL: vi.fn((r: unknown) => {
    if (r === null || r === undefined) return r;
    if (typeof r !== 'object' || Array.isArray(r)) return r;
    const keys = Object.keys(r as Record<string, unknown>);
    if (keys.length === 1) return (r as Record<string, unknown>)[keys[0]!];
    return r;
  }),
}));

// Stub auto-imports
vi.stubGlobal(
  'wrapServiceCall',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);
vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('createAppError', vi.fn());
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
});

let ordersService: typeof import('../../../server/services/orders');

describe('orders service', () => {
  const mockEvent = {
    context: {
      tenant: {
        config: { geinsSettings: { availableLocales: ['sv-SE'] } },
      },
    },
  } as unknown as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    ordersService = await import('../../../server/services/orders');
  });

  describe('getOrder', () => {
    it('calls oms.order.get with requestContext for userToken', async () => {
      const orderData = { id: 1, publicId: 'abc-123', status: 'Placed' };
      mockOrderGet.mockResolvedValueOnce(orderData);

      const result = await ordersService.getOrder(
        { publicOrderId: 'abc-123' },
        mockEvent,
      );

      expect(mockOrderGet).toHaveBeenCalledWith(
        { publicOrderId: 'abc-123' },
        { languageId: 'sv-SE', marketId: 'se', userToken: 'test-user-token' },
      );
      expect(result).toEqual(orderData);
    });
  });

  describe('listOrders', () => {
    it('calls graphql.query with getCompanyOrders query and channel variables', async () => {
      const graphqlResult = {
        getCompanyOrders: [
          { id: 1, status: 'Placed', publicId: 'abc-123' },
          { id: 2, status: 'Completed', publicId: 'def-456' },
        ],
      };
      mockGraphqlQuery.mockResolvedValueOnce(graphqlResult);

      const result = await ordersService.listOrders(mockEvent);

      expect(mockGraphqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: 'query:orders/orders-list.graphql',
          variables: expect.objectContaining({
            channelId: '1|se',
            languageId: 'sv-SE',
            marketId: 'se',
          }),
        }),
      );
      // unwrapGraphQL is mocked to return as-is, so result.orders is the raw graphql result
      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('total');
    });

    it('returns empty array when getOrders returns null', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ getCompanyOrders: null });

      const result = await ordersService.listOrders(mockEvent);

      expect(result.orders).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('joins each order to the company buyer roster via internalId, falling back to email', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getCompanyOrders: [
          {
            id: 1,
            status: 'Placed',
            publicId: 'a',
            customerId: 101,
            customerEmail: null,
          },
          {
            id: 2,
            status: 'Placed',
            publicId: 'b',
            customerId: 202,
            customerEmail: null,
          },
          {
            id: 3,
            status: 'Placed',
            publicId: 'c',
            customerId: null,
            customerEmail: 'ONE@example.com',
          },
          {
            id: 4,
            status: 'Placed',
            publicId: 'd',
            customerId: 999,
            customerEmail: null,
          },
          {
            id: 5,
            status: 'Placed',
            publicId: 'e',
            customerId: null,
            customerEmail: null,
          },
        ],
      });

      const result = await ordersService.listOrders(mockEvent);

      // Two orders by two different buyers must resolve to two different names.
      expect(result.orders[0]!.placedBy).toBe('Anna Nilsson');
      expect(result.orders[1]!.placedBy).toBe('Bea Karlsson');
      expect(result.orders[0]!.placedBy).not.toBe(result.orders[1]!.placedBy);
      // case-insensitive email fallback when customerId is missing
      expect(result.orders[2]!.placedBy).toBe('Anna Nilsson');
      // unknown customerId and fully-missing identifiers both stay null
      expect(result.orders[3]!.placedBy).toBeNull();
      expect(result.orders[4]!.placedBy).toBeNull();
    });
  });
});
