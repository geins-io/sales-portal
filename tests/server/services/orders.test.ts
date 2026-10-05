import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import { OrderError } from '@geins/core';
import { logger } from '../../../server/utils/logger';

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

const orderLineConfigurations = vi.fn();
// As the merchant-api backend answers: by the product's type.
const byType = ({ type }: { productId: string; type?: string | null }) =>
  type === 'configurable';
const isConfigurable = vi.fn(byType);

vi.mock('../../../server/services/configurator', () => ({
  getConfiguratorBackend: () => ({ orderLineConfigurations }),
  buildConfiguratorRequestContext: async () => ({ configuratorContext: true }),
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
    orderLineConfigurations.mockResolvedValue(new Map());
    isConfigurable.mockImplementation(byType);
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
      expect(vi.mocked(wrapServiceCall).mock.calls[0]?.slice(1)).toEqual([
        'order',
        OrderError,
      ]);
      expect(result).toEqual({ ...orderData, reorderable: true });
    });

    describe('the rows as the configurator reads them', () => {
      const SUMMARY = [
        { label: 'Adapter', value: 'S45' },
        { label: 'Width (500-1500)', value: '1200 mm' },
      ];
      const OTHER_SUMMARY = [{ label: 'Adapter', value: 'S60' }];

      function sdkOrder() {
        return {
          publicId: 'abc-123',
          cart: {
            items: [
              { skuId: 10, quantity: 2, product: { productId: 7 } },
              { skuId: 20, quantity: 1, product: { productId: 1359 } },
              { skuId: 20, quantity: 1, product: { productId: 1359 } },
            ],
          },
        };
      }

      function line(
        productId: number | null,
        type: string | null,
        summary: { label: string; value: string }[] | null = null,
      ) {
        return { productId, type, configuration: summary && { summary } };
      }

      let warn: ReturnType<typeof vi.spyOn>;
      beforeEach(() => {
        warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      });

      it('reads the rows of the order it was asked for', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());

        await ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent);

        expect(orderLineConfigurations).toHaveBeenCalledWith('abc-123', {
          configuratorContext: true,
        });
      });

      it('puts each configuration on the row at its position, two rows of one SKU each their own', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([
            [0, line(7, 'product')],
            [1, line(1359, 'configurable', SUMMARY)],
            [2, line(1359, 'configurable', OTHER_SUMMARY)],
          ]),
        );

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order?.cart?.items).toEqual([
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
        expect(order?.publicId).toBe('abc-123');
        expect(order?.reorderable).toBe(true);
      });

      it('flags a configurable row the configurator holds no configuration for', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([[1, line(1359, 'configurable')]]),
        );

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order?.cart?.items[1]).toEqual({
          skuId: 20,
          quantity: 1,
          product: { productId: 1359, configurable: true },
        });
      });

      it('keeps the configuration on a row whose product no longer reads as configurable', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([[1, line(1359, 'product', SUMMARY)]]),
        );

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order?.cart?.items[1]).toEqual({
          skuId: 20,
          quantity: 1,
          product: { productId: 1359 },
          configuration: { summary: SUMMARY },
        });
      });

      it('asks the seam about every row, by product id and the type read for it', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([[1, line(1359, 'configurable')]]),
        );

        await ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent);

        expect(isConfigurable.mock.calls).toEqual([
          [{ productId: '7', type: null }],
          [{ productId: '1359', type: 'configurable' }],
          [{ productId: '1359', type: null }],
        ]);
      });

      it('flags a row the backend answers for by product id alone, with no row read', async () => {
        // The fixture: its seeds are ordinary catalogue products, so it reads
        // no type and answers from the id.
        isConfigurable.mockImplementation(({ productId }) => productId === '7');
        mockOrderGet.mockResolvedValueOnce(sdkOrder());

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order?.cart?.items.map((i) => i?.product)).toEqual([
          { productId: 7, configurable: true },
          { productId: 1359 },
          { productId: 1359 },
        ]);
      });

      it('never passes the type on', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([
            [0, line(7, 'product')],
            [1, line(1359, 'configurable', SUMMARY)],
          ]),
        );

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(JSON.stringify(order)).not.toContain('"type"');
      });

      it('leaves a row bare and unflagged, and the order not reorderable, when the product at that position is another', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([
            [0, line(1359, 'configurable', SUMMARY)],
            [1, line(1359, 'configurable')],
            [2, line(1359, 'configurable')],
          ]),
        );

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order?.cart?.items[0]).toEqual(sdkOrder().cart.items[0]);
        expect(order?.reorderable).toBe(false);
      });

      it('answers an order not reorderable when the read holds no row at the position of a product row', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([
            [0, line(7, 'product')],
            [1, line(1359, 'configurable')],
          ]),
        );

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order?.reorderable).toBe(false);
      });

      it('answers an order reorderable when every product row matches its read', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([
            [0, line(7, 'product')],
            [1, line(1359, 'configurable')],
            [2, line(1359, 'configurable')],
          ]),
        );

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order?.reorderable).toBe(true);
      });

      it('leaves a row bare when the read names no product', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([[1, line(null, 'configurable', SUMMARY)]]),
        );

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order).toEqual({ ...sdkOrder(), reorderable: false });
      });

      it.each([
        ['the row has no product', { skuId: 20 }],
        [
          'neither names a product',
          { skuId: 20, product: { productId: null } },
        ],
      ])('leaves a row bare when %s', async (_case, row) => {
        const order = { publicId: 'abc-123', cart: { items: [row] } };
        mockOrderGet.mockResolvedValueOnce(order);
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([[0, line(null, 'configurable', SUMMARY)]]),
        );

        await expect(
          ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent),
        ).resolves.toEqual({ ...order, reorderable: true });
      });

      it('leaves a row without a product bare when the read names one', async () => {
        const order = { publicId: 'abc-123', cart: { items: [{ skuId: 20 }] } };
        mockOrderGet.mockResolvedValueOnce(order);
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([[0, line(1359, 'configurable', SUMMARY)]]),
        );

        await expect(
          ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent),
        ).resolves.toEqual({ ...order, reorderable: true });
      });

      it('answers the order unchanged but not reorderable, with one warning, when the read fails', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());
        orderLineConfigurations.mockRejectedValueOnce(new Error('timed out'));

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order).toEqual({ ...sdkOrder(), reorderable: false });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
          '[configurator] order line configurations unavailable',
        );
      });

      it('answers a reorderable order when the backend reads no rows (configurator off)', async () => {
        mockOrderGet.mockResolvedValueOnce(sdkOrder());

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order).toEqual({ ...sdkOrder(), reorderable: true });
      });

      it('answers no order while the order does not exist yet', async () => {
        mockOrderGet.mockResolvedValueOnce(undefined);
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([[0, line(7, 'configurable', SUMMARY)]]),
        );

        await expect(
          ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent),
        ).resolves.toBeUndefined();
      });

      it.each([
        ['no cart', null],
        ['no rows', { items: null }],
      ])('answers an order with %s as it came', async (_case, cart) => {
        const bare = { publicId: 'abc-123', cart };
        mockOrderGet.mockResolvedValueOnce(bare);
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([[0, line(7, 'configurable', SUMMARY)]]),
        );

        await expect(
          ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent),
        ).resolves.toEqual({ ...bare, reorderable: true });
      });

      it('answers an order without rows not reorderable when the read fails', async () => {
        const bare = { publicId: 'abc-123', cart: null };
        mockOrderGet.mockResolvedValueOnce(bare);
        orderLineConfigurations.mockRejectedValueOnce(new Error('timed out'));

        await expect(
          ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent),
        ).resolves.toEqual({ ...bare, reorderable: false });
      });

      it('skips a null row and keeps its position', async () => {
        mockOrderGet.mockResolvedValueOnce({
          publicId: 'abc-123',
          cart: { items: [null, { skuId: 20, product: { productId: 1359 } }] },
        });
        orderLineConfigurations.mockResolvedValueOnce(
          new Map([[1, line(1359, 'configurable', SUMMARY)]]),
        );

        const order = await ordersService.getOrder(
          { publicOrderId: 'abc-123' },
          mockEvent,
        );

        expect(order?.cart?.items).toEqual([
          null,
          {
            skuId: 20,
            product: { productId: 1359, configurable: true },
            configuration: { summary: SUMMARY },
          },
        ]);
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
