import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import { OrderError } from '@geins/core';

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

const getConfiguratorBackend = vi.fn();
// As the merchant-api backend answers: by the product's type.
const byType = ({ type }: { productId: string; type?: string | null }) =>
  type === 'configurable';
const isConfigurable = vi.fn(byType);

vi.mock('../../../server/services/configurator', () => ({
  getConfiguratorBackend,
  configurableCheck: () => isConfigurable,
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
    isConfigurable.mockImplementation(byType);
    ordersService = await import('../../../server/services/orders');
  });

  describe('getOrder', () => {
    it('reads the order with one call to oms.order.get, with requestContext for userToken', async () => {
      const orderData = { id: 1, publicId: 'abc-123', status: 'Placed' };
      mockOrderGet.mockResolvedValueOnce(orderData);

      const result = await ordersService.getOrder(
        { publicOrderId: 'abc-123' },
        mockEvent,
      );

      expect(mockOrderGet).toHaveBeenCalledTimes(1);
      expect(mockOrderGet).toHaveBeenCalledWith(
        { publicOrderId: 'abc-123' },
        { languageId: 'sv-SE', marketId: 'se', userToken: 'test-user-token' },
      );
      expect(vi.mocked(wrapServiceCall).mock.calls[0]?.slice(1)).toEqual([
        'order',
        OrderError,
      ]);
      expect(getConfiguratorBackend).not.toHaveBeenCalled();
      expect(result).toEqual(orderData);
    });

    it('answers no order while the order does not exist yet', async () => {
      mockOrderGet.mockResolvedValueOnce(undefined);

      await expect(
        ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent),
      ).resolves.toBeUndefined();
    });

    describe('the rows as the order reads them', () => {
      const SUMMARY = [
        { label: 'Adapter', value: 'S45' },
        { label: 'Width (500-1500)', value: '1200 mm' },
      ];

      function sdkOrder(items: unknown[]) {
        return { publicId: 'abc-123', cart: { items } };
      }

      async function rowsOf(items: unknown[]) {
        mockOrderGet.mockResolvedValueOnce(sdkOrder(items));
        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );
        return order?.cart?.items;
      }

      it('flags a configured row and carries its summary, two rows of one SKU each their own', async () => {
        const OTHER_SUMMARY = [{ label: 'Adapter', value: 'S60' }];

        const rows = await rowsOf([
          {
            skuId: 10,
            quantity: 2,
            product: { productId: 7, type: 'product' },
          },
          {
            skuId: 20,
            quantity: 1,
            product: { productId: 1359, type: 'configurable' },
            configuration: { summary: SUMMARY },
          },
          {
            skuId: 20,
            quantity: 1,
            product: { productId: 1359, type: 'configurable' },
            configuration: { summary: OTHER_SUMMARY },
          },
        ]);

        expect(rows).toStrictEqual([
          { skuId: 10, quantity: 2, product: { productId: 7 } },
          {
            skuId: 20,
            quantity: 1,
            product: { productId: 1359, configurable: true },
            configuration: { summary: SUMMARY },
          },
          {
            skuId: 20,
            quantity: 1,
            product: { productId: 1359, configurable: true },
            configuration: { summary: OTHER_SUMMARY },
          },
        ]);
      });

      it("reads a row's committed sections beside its summary, as the buyer reads them", async () => {
        const rows = await rowsOf([
          {
            skuId: 20,
            product: { productId: 1359, type: 'configurable' },
            configuration: {
              summary: [{ label: 'Adapter', value: null }],
              sections: [
                {
                  name: 'Machine',
                  sortIndex: 2,
                  variables: [],
                  optionGroups: [],
                  sections: null,
                },
              ],
            },
          },
        ]);

        expect(rows?.[0]?.configuration).toStrictEqual({
          summary: [{ label: 'Adapter', value: '' }],
          sections: [
            {
              name: 'Machine',
              sortIndex: 2,
              variables: [],
              optionGroups: [],
              sections: [],
            },
          ],
        });
      });

      it('flags a configured row the order holds no configuration for', async () => {
        // The order read answers a null configuration where it could not read one.
        const rows = await rowsOf([
          { skuId: 20, product: { productId: 1359, type: 'configurable' } },
        ]);

        expect(rows).toStrictEqual([
          { skuId: 20, product: { productId: 1359, configurable: true } },
        ]);
      });

      it('keeps the configuration on a row whose product no longer reads as configurable', async () => {
        const rows = await rowsOf([
          {
            skuId: 20,
            product: { productId: 1359, type: 'product' },
            configuration: { summary: SUMMARY },
          },
        ]);

        expect(rows).toStrictEqual([
          {
            skuId: 20,
            product: { productId: 1359 },
            configuration: { summary: SUMMARY },
          },
        ]);
      });

      it('asks the seam about every row, by product id and its type', async () => {
        await rowsOf([
          { skuId: 10, product: { productId: 7, type: 'product' } },
          { skuId: 20, product: { productId: 1359, type: 'configurable' } },
          { skuId: 30, product: { productId: 8 } },
        ]);

        expect(isConfigurable.mock.calls).toEqual([
          [{ productId: '7', type: 'product' }],
          [{ productId: '1359', type: 'configurable' }],
          [{ productId: '8', type: null }],
        ]);
      });

      it('flags a row the backend answers for by product id alone', async () => {
        // The fixture: its seeds are ordinary catalogue products, so it
        // answers from the id, not the type.
        isConfigurable.mockImplementation(({ productId }) => productId === '7');

        const rows = await rowsOf([
          { skuId: 10, product: { productId: 7, type: 'product' } },
          { skuId: 20, product: { productId: 1359, type: 'configurable' } },
        ]);

        expect(rows?.map((row) => row?.product)).toStrictEqual([
          { productId: 7, configurable: true },
          { productId: 1359 },
        ]);
      });

      it('never passes the type or a configuration id on', async () => {
        const rows = await rowsOf([
          {
            skuId: 20,
            product: { productId: 1359, type: 'configurable' },
            configurationId: 'committed-1',
            configuration: { summary: SUMMARY },
          },
          {
            skuId: 30,
            product: { productId: null, type: 'product' },
            configurationId: undefined,
          },
        ]);

        expect(JSON.stringify(rows)).not.toContain('"type"');
        expect(JSON.stringify(rows)).not.toContain('configurationId');
      });

      it.each([
        ['the row has no product', { skuId: 20 }],
        [
          'the product names no id',
          { skuId: 20, product: { productId: null } },
        ],
      ])(
        'leaves a row unflagged and asks nothing when %s',
        async (_case, row) => {
          await expect(rowsOf([row])).resolves.toStrictEqual([row]);
          expect(isConfigurable).not.toHaveBeenCalled();
        },
      );

      it('keeps a null row in its place', async () => {
        const rows = await rowsOf([
          null,
          { skuId: 20, product: { productId: 1359, type: 'configurable' } },
        ]);

        expect(rows).toStrictEqual([
          null,
          { skuId: 20, product: { productId: 1359, configurable: true } },
        ]);
      });

      it.each([
        ['no cart', null],
        ['no rows', { items: null }],
      ])('answers an order with %s as it came', async (_case, cart) => {
        const bare = { publicId: 'abc-123', cart };
        mockOrderGet.mockResolvedValueOnce(bare);

        await expect(
          ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent),
        ).resolves.toStrictEqual(bare);
      });
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
