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

// The catalogue in the request language. Empty by default, so a test that
// does not set it reads the rows as the order carries them.
const mockGetCatalogueProducts = vi.fn();
vi.mock('../../../server/services/products', () => ({
  getCatalogueProducts: (...args: unknown[]) =>
    mockGetCatalogueProducts(...args),
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
      // No email, and a last name that is only a space.
      { internalId: '303', firstName: 'Cleo', lastName: ' ' },
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
        config: { channelSettings: { locales: ['sv-SE'] } },
      },
    },
  } as unknown as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    isConfigurable.mockImplementation(byType);
    mockGetCatalogueProducts.mockResolvedValue(new Map());
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

    // An order line carries its product only in the language the order was
    // placed in; in any other language its alias is "" and its images null.
    describe('in the language of the page', () => {
      const COPPER = {
        productId: 1031,
        name: 'Copper pipe 18 mm 5 m EN 1057',
        alias: 'copper-pipe-18-mm-5-m-en-1057',
        canonicalUrl: '/se/en/p/pipes/copper-pipe-18-mm-5-m-en-1057',
        productImages: [{ fileName: 'ror.jpg', url: 'https://cdn/ror.jpg' }],
      };

      function swedishRow(overrides: Record<string, unknown> = {}) {
        return {
          skuId: 10,
          quantity: 3,
          product: {
            productId: 1031,
            type: 'product',
            articleNumber: 'ROR-CU-18-5M',
            name: 'Kopparrör 18 mm 5 m EN 1057',
            alias: '',
            canonicalUrl: null,
            productImages: null,
          },
          ...overrides,
        };
      }

      async function orderOf(items: unknown[]) {
        mockOrderGet.mockResolvedValueOnce({
          publicId: 'abc-123',
          cart: { items },
        });
        return ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent);
      }

      it("takes each row's name, alias, link and images from the catalogue, the rest from the order", async () => {
        mockGetCatalogueProducts.mockResolvedValue(new Map([[1031, COPPER]]));

        const order = await orderOf([swedishRow()]);

        expect(order?.cart?.items).toEqual([
          {
            skuId: 10,
            quantity: 3,
            product: {
              productId: 1031,
              articleNumber: 'ROR-CU-18-5M',
              name: 'Copper pipe 18 mm 5 m EN 1057',
              alias: 'copper-pipe-18-mm-5-m-en-1057',
              canonicalUrl: '/se/en/p/pipes/copper-pipe-18-mm-5-m-en-1057',
              productImages: [
                { fileName: 'ror.jpg', url: 'https://cdn/ror.jpg' },
              ],
            },
          },
        ]);
      });

      it('keeps the row as the order carries it for a product the catalogue no longer has', async () => {
        const order = await orderOf([swedishRow()]);

        expect(order?.cart?.items?.[0]?.product).toMatchObject({
          name: 'Kopparrör 18 mm 5 m EN 1057',
          alias: '',
          productImages: null,
        });
      });

      it("keeps the row's images when the catalogue product has none", async () => {
        mockGetCatalogueProducts.mockResolvedValue(
          new Map([[1031, { ...COPPER, productImages: [] }]]),
        );
        const images = [{ fileName: 'old.jpg', url: 'https://cdn/old' }];

        const order = await orderOf([
          swedishRow({
            product: { ...swedishRow().product, productImages: images },
          }),
        ]);

        expect(order?.cart?.items?.[0]?.product?.productImages).toEqual(images);
      });

      it.each([
        ['no images', null],
        ['only empty entries', [null, { fileName: '', url: 'https://cdn/x' }]],
      ])(
        "keeps the row's images when the catalogue has %s",
        async (_case, productImages) => {
          mockGetCatalogueProducts.mockResolvedValue(
            new Map([[1031, { ...COPPER, productImages }]]),
          );
          const images = [{ fileName: 'old.jpg', url: 'https://cdn/old' }];

          const order = await orderOf([
            swedishRow({
              product: { ...swedishRow().product, productImages: images },
            }),
          ]);

          expect(order?.cart?.items?.[0]?.product?.productImages).toEqual(
            images,
          );
        },
      );

      it('takes the images that have a file name, an image without a URL as null', async () => {
        mockGetCatalogueProducts.mockResolvedValue(
          new Map([
            [
              1031,
              { ...COPPER, productImages: [null, { fileName: 'ror.jpg' }] },
            ],
          ]),
        );

        const order = await orderOf([swedishRow()]);

        expect(order?.cart?.items?.[0]?.product?.productImages).toEqual([
          { fileName: 'ror.jpg', url: null },
        ]);
      });

      it('asks the catalogue without a token when the request has no context', async () => {
        const sdk = await import('../../../server/services/_sdk');
        vi.mocked(sdk.buildRequestContext).mockReturnValueOnce(undefined);

        await orderOf([swedishRow()]);

        expect(mockGetCatalogueProducts).toHaveBeenCalledWith(
          [1031],
          mockEvent,
          undefined,
        );
      });

      it('asks the catalogue once per order, each product once, with the buyer token', async () => {
        await orderOf([
          swedishRow(),
          swedishRow({ skuId: 11 }),
          swedishRow({ product: { ...swedishRow().product, productId: 42 } }),
          null,
        ]);

        expect(mockGetCatalogueProducts).toHaveBeenCalledOnce();
        expect(mockGetCatalogueProducts).toHaveBeenCalledWith(
          [1031, 42],
          mockEvent,
          'test-user-token',
        );
      });

      it('keeps a configured row configured, its configuration and flag beside the catalogue values', async () => {
        mockGetCatalogueProducts.mockResolvedValue(new Map([[1031, COPPER]]));

        const order = await orderOf([
          swedishRow({
            configurationId: 'cfg-1',
            configuration: { summary: [{ label: 'Adapter', value: 'S45' }] },
            product: { ...swedishRow().product, type: 'configurable' },
          }),
        ]);
        const row = order?.cart?.items?.[0];

        expect(row?.configuration).toBeDefined();
        expect(row?.product).toMatchObject({
          configurable: true,
          name: 'Copper pipe 18 mm 5 m EN 1057',
          alias: 'copper-pipe-18-mm-5-m-en-1057',
        });
      });

      it('does not ask the catalogue for an order without product rows', async () => {
        await orderOf([null]);
        mockOrderGet.mockResolvedValueOnce({ publicId: 'abc-123', cart: null });
        await ordersService.getOrder({ publicOrderId: 'abc-123' }, mockEvent);

        expect(mockGetCatalogueProducts).not.toHaveBeenCalled();
      });
    });
  });

  describe('listOrders', () => {
    const query = { mine: false, skip: 0, take: 20 };

    /** Geins answers the one root the query asked for. */
    const companyPage = (
      orders: Array<Record<string, unknown>>,
      count = orders.length,
    ) => ({
      company: { count, orders },
    });

    it('reads one page of the company orders, with its skip, take and the channel', async () => {
      mockGraphqlQuery.mockResolvedValueOnce(companyPage([]));

      await ordersService.listOrders(
        { mine: false, skip: 40, take: 20 },
        mockEvent,
      );

      expect(mockGraphqlQuery).toHaveBeenCalledWith({
        queryAsString: 'query:orders/order-list-page.graphql',
        variables: {
          mine: false,
          skip: 40,
          take: 20,
          channelId: '1|se',
          languageId: 'sv-SE',
          marketId: 'se',
        },
        userToken: 'test-user-token',
      });
    });

    it("reads the buyer's own orders with mine", async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        mine: { count: 84, orders: [{ id: 7, status: 'Placed' }] },
      });

      const result = await ordersService.listOrders(
        { mine: true, skip: 0, take: 20 },
        mockEvent,
      );

      expect(mockGraphqlQuery.mock.calls[0]![0].variables).toMatchObject({
        mine: true,
      });
      expect(result.total).toBe(84);
      expect(result.orders.map((order) => order.id)).toEqual([7]);
    });

    it('sends the search on, and no search when there is none', async () => {
      mockGraphqlQuery
        .mockResolvedValueOnce(companyPage([]))
        .mockResolvedValueOnce(companyPage([]));

      await ordersService.listOrders({ ...query, search: '121' }, mockEvent);
      await ordersService.listOrders(query, mockEvent);

      expect(mockGraphqlQuery.mock.calls[0]![0].variables.search).toBe('121');
      expect(mockGraphqlQuery.mock.calls[1]![0].variables).not.toHaveProperty(
        'search',
      );
    });

    it("answers the page's rows and the count of every order, not of the page", async () => {
      mockGraphqlQuery.mockResolvedValueOnce(
        companyPage(
          [
            { id: 2, status: 'Placed', publicId: 'b' },
            { id: 1, status: 'Completed', publicId: 'a' },
          ],
          103,
        ),
      );

      const result = await ordersService.listOrders(query, mockEvent);

      expect(result.total).toBe(103);
      expect(result.orders.map((order) => order.id)).toEqual([2, 1]);
    });

    it('answers no rows and a 0 when Geins answers no page', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ company: null });

      const result = await ordersService.listOrders(query, mockEvent);

      expect(result).toEqual({ orders: [], total: 0 });
    });

    it('answers no rows and the count for a page past the end', async () => {
      mockGraphqlQuery.mockResolvedValueOnce(companyPage([], 103));

      const result = await ordersService.listOrders(
        { ...query, skip: 200 },
        mockEvent,
      );

      expect(result).toEqual({ orders: [], total: 103 });
    });

    it('lets a failed read through', async () => {
      mockGraphqlQuery.mockRejectedValueOnce(new Error('Geins 502'));

      await expect(ordersService.listOrders(query, mockEvent)).rejects.toThrow(
        'Geins 502',
      );
    });

    describe("each order's total", () => {
      const total = {
        sellingPriceIncVat: 1800,
        sellingPriceIncVatFormatted: '1 800 kr',
        sellingPriceExVat: 1440,
        sellingPriceExVatFormatted: '1 440 kr',
      };
      const withTotal = (order: Record<string, unknown>) => ({
        id: 1,
        status: 'Placed',
        publicId: 'a',
        orderTotal: total,
        ...order,
      });

      it("has two decimals, in the order's currency, where Geins' string has none", async () => {
        mockGraphqlQuery.mockResolvedValueOnce(
          companyPage([withTotal({ currency: 'SEK' })]),
        );

        const result = await ordersService.listOrders(query, mockEvent);

        expect(result.orders[0]!.orderTotal).toEqual({
          sellingPriceIncVat: 1800,
          sellingPriceIncVatFormatted: '1 800,00 kr',
          sellingPriceExVat: 1440,
          sellingPriceExVatFormatted: '1 440,00 kr',
        });
      });

      it("keeps Geins' strings for an order without a currency", async () => {
        mockGraphqlQuery.mockResolvedValueOnce(
          companyPage([withTotal({ currency: null })]),
        );

        const result = await ordersService.listOrders(query, mockEvent);

        expect(result.orders[0]!.orderTotal).toEqual(total);
      });

      it('leaves an order without a total as it came', async () => {
        mockGraphqlQuery.mockResolvedValueOnce(
          companyPage([
            withTotal({ currency: 'SEK', orderTotal: null }),
            withTotal({ currency: 'SEK', orderTotal: undefined }),
          ]),
        );

        const result = await ordersService.listOrders(query, mockEvent);

        expect(result.orders[0]!.orderTotal).toBeNull();
        expect(result.orders[1]!.orderTotal).toBeUndefined();
      });

      it("keeps Geins' string for an amount it does not give as a number", async () => {
        mockGraphqlQuery.mockResolvedValueOnce(
          companyPage([
            withTotal({
              currency: 'SEK',
              orderTotal: { sellingPriceExVatFormatted: '1 440 kr' },
            }),
          ]),
        );

        const result = await ordersService.listOrders(query, mockEvent);

        expect(result.orders[0]!.orderTotal).toEqual({
          sellingPriceExVatFormatted: '1 440 kr',
        });
      });
    });

    it('joins each order to the company buyer roster via internalId, falling back to email', async () => {
      mockGraphqlQuery.mockResolvedValueOnce(
        companyPage([
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
        ]),
      );

      const result = await ordersService.listOrders(query, mockEvent);

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

    it('names a buyer the roster lists without an email, without the blank around the name', async () => {
      mockGraphqlQuery.mockResolvedValueOnce(
        companyPage([{ id: 1, status: 'Placed', customerId: 303 }]),
      );

      const result = await ordersService.listOrders(query, mockEvent);

      expect(result.orders[0]!.placedBy).toBe('Cleo');
    });

    it('reads as an order read, so a failure is reported as one', async () => {
      mockGraphqlQuery.mockResolvedValueOnce(companyPage([]));

      await ordersService.listOrders(query, mockEvent);

      expect(wrapServiceCall).toHaveBeenCalledWith(
        expect.any(Function),
        'order',
        OrderError,
      );
    });

    it('reads without a token when the request carries no context', async () => {
      const { buildRequestContext } =
        await import('../../../server/services/_sdk');
      vi.mocked(buildRequestContext).mockReturnValueOnce(undefined);
      mockGraphqlQuery.mockResolvedValueOnce(companyPage([]));

      await ordersService.listOrders(query, mockEvent);

      expect(mockGraphqlQuery.mock.calls[0]![0].userToken).toBeUndefined();
    });

    it('leaves every row without a name when the roster cannot be read', async () => {
      const { getCompany } = await import('../../../server/services/company');
      vi.mocked(getCompany).mockRejectedValueOnce(new Error('no company'));
      mockGraphqlQuery.mockResolvedValueOnce(
        companyPage([{ id: 1, status: 'Placed', customerId: 101 }]),
      );

      const result = await ordersService.listOrders(query, mockEvent);

      expect(result.orders[0]!.placedBy).toBeNull();
    });
  });

  describe('getOrderOverview', () => {
    it("reads the company's newest orders and their count, with the channel", async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        companyOrders: {
          count: 103,
          orders: [
            { id: 1216, status: 'Placed', customerId: 202 },
            { id: 1215, status: 'Placed', customerId: 101 },
          ],
        },
      });

      const result = await ordersService.getOrderOverview(mockEvent);

      expect(mockGraphqlQuery).toHaveBeenCalledWith({
        queryAsString: 'query:orders/order-overview.graphql',
        variables: { channelId: '1|se', languageId: 'sv-SE', marketId: 'se' },
        userToken: 'test-user-token',
      });
      expect(result.total).toBe(103);
      expect(
        result.orders.map(({ id, placedBy }) => ({ id, placedBy })),
      ).toEqual([
        { id: 1216, placedBy: 'Bea Karlsson' },
        { id: 1215, placedBy: 'Anna Nilsson' },
      ]);
    });

    it('writes the totals as the list does', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        companyOrders: {
          count: 1,
          orders: [
            {
              id: 1,
              status: 'Placed',
              currency: 'SEK',
              orderTotal: {
                sellingPriceIncVat: 1800,
                sellingPriceIncVatFormatted: '1 800 kr',
              },
            },
          ],
        },
      });

      const result = await ordersService.getOrderOverview(mockEvent);

      expect(result.orders[0]!.orderTotal?.sellingPriceIncVatFormatted).toBe(
        '1 800,00 kr',
      );
    });

    it('answers no rows and a 0 when Geins answers no page', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ companyOrders: null });

      expect(await ordersService.getOrderOverview(mockEvent)).toEqual({
        orders: [],
        total: 0,
      });
    });
  });
});

describe('orders service: an order by its number', () => {
  const mockEvent = {
    context: {
      tenant: { config: { channelSettings: { locales: ['sv-SE'] } } },
    },
  } as unknown as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    isConfigurable.mockImplementation(byType);
    ordersService = await import('../../../server/services/orders');
  });

  describe('findOrderPublicId', () => {
    it('asks getOrder by the number, as the buyer, in the channel', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getOrder: { publicId: 'pub-1155' },
      });

      const result = await ordersService.findOrderPublicId(1155, mockEvent);

      expect(mockGraphqlQuery).toHaveBeenCalledWith({
        queryAsString: 'query:orders/order-public-id.graphql',
        variables: {
          orderId: 1155,
          channelId: '1|se',
          languageId: 'sv-SE',
          marketId: 'se',
        },
        userToken: 'test-user-token',
      });
      expect(vi.mocked(wrapServiceCall).mock.calls[0]?.slice(1)).toEqual([
        'order',
        OrderError,
      ]);
      expect(result).toBe('pub-1155');
    });

    // Geins answers null alike for an order not readable yet, one of another
    // company and one that does not exist.
    it('answers nothing when Geins answers no order', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ getOrder: null });

      await expect(
        ordersService.findOrderPublicId(1155, mockEvent),
      ).resolves.toBeUndefined();
    });

    it('asks without a user token when the request carries no context', async () => {
      const { buildRequestContext } =
        await import('../../../server/services/_sdk');
      vi.mocked(buildRequestContext).mockReturnValueOnce(undefined);
      mockGraphqlQuery.mockResolvedValueOnce({ getOrder: null });

      await ordersService.findOrderPublicId(1155, mockEvent);

      expect(mockGraphqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({ userToken: undefined }),
      );
    });

    it('answers nothing for an order without a public id', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ getOrder: { publicId: '' } });

      await expect(
        ordersService.findOrderPublicId(1155, mockEvent),
      ).resolves.toBeUndefined();
    });
  });

  describe('getOrderByNumber', () => {
    it('reads the order the portal reads, by the public id the number gives', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getOrder: { publicId: 'pub-1155' },
      });
      mockOrderGet.mockResolvedValueOnce({ id: 1155, publicId: 'pub-1155' });

      const result = await ordersService.getOrderByNumber(1155, mockEvent);

      expect(mockOrderGet).toHaveBeenCalledWith(
        { publicOrderId: 'pub-1155' },
        expect.anything(),
      );
      expect(result).toEqual({ id: 1155, publicId: 'pub-1155' });
    });

    it('asks no further when the number gives no order', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ getOrder: null });

      await expect(
        ordersService.getOrderByNumber(1155, mockEvent),
      ).resolves.toBeUndefined();
      expect(mockOrderGet).not.toHaveBeenCalled();
    });
  });
});
