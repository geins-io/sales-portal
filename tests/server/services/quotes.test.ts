import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import { makeRawQuotationCart } from '../../fixtures/quote';

// Mock the SDK module
const mockGraphqlQuery = vi.fn();
const mockGraphqlMutation = vi.fn();

const mockSDK = {
  core: {
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se', tld: 'se' },
    graphql: { query: mockGraphqlQuery, mutation: mockGraphqlMutation },
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

const mockFindOrderPublicId = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../server/services/orders', () => ({
  findOrderPublicId: (...args: unknown[]) => mockFindOrderPublicId(...args),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
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
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => {
    const err = new Error(msg);
    (err as unknown as Record<string, unknown>).statusCode =
      code === 'NOT_FOUND' ? 404 : 400;
    (err as unknown as Record<string, unknown>).code = code;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  QUOTE_LINE_GONE: 'QUOTE_LINE_GONE',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
});

let quotesService: typeof import('../../../server/services/quotes');

/** An amount as `Intl` writes it in sv-SE: non-breaking spaces. */
const kr = (text: string) => text.replace(/ /g, ' ');

describe('quotes service', () => {
  const mockEvent = {
    context: {
      tenant: {
        config: { channelSettings: { locales: ['sv-SE'] } },
      },
    },
  } as unknown as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    quotesService = await import('../../../server/services/quotes');
  });

  // -------------------------------------------------------------------------
  // listQuotes
  // -------------------------------------------------------------------------
  describe('listQuotes', () => {
    it('calls graphql.query with listQuotationCarts query and channel variables', async () => {
      const cart = makeRawQuotationCart();
      mockGraphqlQuery.mockResolvedValueOnce({
        listQuotationCarts: [cart],
      });

      const result = await quotesService.listQuotes('org-1', 0, 10, mockEvent);

      expect(mockGraphqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: 'query:quotes/list-quotations.graphql',
          userToken: 'test-user-token',
          variables: { languageId: 'sv-SE' },
        }),
      );

      expect(result.quotes).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.quotes[0]).toMatchObject({
        id: 'cart-001',
        quoteNumber: 'Q-20260101001',
        status: 'pending',
        totalFormatted: kr('10 039,00 kr'),
        totalExVat: 8031.2,
        totalExVatFormatted: kr('8 031,20 kr'),
        currency: 'SEK',
        itemCount: 1,
      });
    });

    it.each([
      ['no summary', undefined],
      ['an empty summary', {}],
    ])(
      'lists a quotation with %s at an empty ex-VAT total',
      async (_, summary) => {
        const cart = makeRawQuotationCart();
        cart.summary = summary;
        mockGraphqlQuery.mockResolvedValueOnce({ listQuotationCarts: [cart] });

        const result = await quotesService.listQuotes(
          'org-1',
          0,
          10,
          mockEvent,
        );

        expect(result.quotes[0]).toMatchObject({
          totalExVat: 0,
          totalExVatFormatted: '',
        });
      },
    );

    it('carries the name the buyer gave the quotation, none when Geins has none', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        listQuotationCarts: [
          makeRawQuotationCart({ name: 'Varukorg 11 nov. 2026' }),
          makeRawQuotationCart({ name: null }),
        ],
      });

      const result = await quotesService.listQuotes('org-1', 0, 10, mockEvent);

      expect(result.quotes.map((q) => q.name)).toEqual([
        'Varukorg 11 nov. 2026',
        undefined,
      ]);
    });

    it("keeps Geins' total when the quotation carries no currency", async () => {
      const cart = makeRawQuotationCart({ currency: null });
      mockGraphqlQuery.mockResolvedValueOnce({ listQuotationCarts: [cart] });

      const result = await quotesService.listQuotes('org-1', 0, 10, mockEvent);

      expect(result.quotes[0]).toMatchObject({
        totalFormatted: '10 039 SEK',
        totalExVatFormatted: '8 031 SEK',
      });
    });

    it('formats the totals in the language the quotation was read in', async () => {
      const sdk = await import('../../../server/services/_sdk');
      vi.mocked(sdk.getRequestChannelVariables).mockReturnValueOnce({
        channelId: '1|se',
        languageId: 'en-GB',
        marketId: 'se',
      });
      mockGraphqlQuery.mockResolvedValueOnce({
        listQuotationCarts: [makeRawQuotationCart()],
      });

      const result = await quotesService.listQuotes('org-1', 0, 10, mockEvent);

      expect(result.quotes[0]!.totalFormatted).toBe('SEK\u00a010,039.00');
    });

    it('returns empty array when listQuotationCarts returns null', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ listQuotationCarts: null });

      const result = await quotesService.listQuotes('org-1', 0, 10, mockEvent);

      expect(result.quotes).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('maps each buyer-facing QuotationStatus to its own QuoteStatus', async () => {
      const statuses = [
        'REQUEST_DRAFT',
        'REQUESTED',
        'PENDING',
        'ACCEPTED',
        'CONFIRMED',
        'FINALIZED',
        'REJECTED',
        'CANCELED',
        'EXPIRED',
      ];
      const carts = statuses.map((status) => makeRawQuotationCart({ status }));
      mockGraphqlQuery.mockResolvedValueOnce({ listQuotationCarts: carts });

      const result = await quotesService.listQuotes(
        'org-1',
        undefined,
        undefined,
        mockEvent,
      );

      const mappedStatuses = result.quotes.map((q) => q.status);
      expect(mappedStatuses).toEqual([
        'request_draft',
        'requested',
        'pending',
        'accepted',
        'confirmed',
        'finalized',
        'rejected',
        'canceled',
        'expired',
      ]);
    });

    it.each([['DRAFT'], ['SOMETHING_NEW'], [undefined]])(
      'maps %s to unknown, never to pending',
      async (status) => {
        mockGraphqlQuery.mockResolvedValueOnce({
          listQuotationCarts: [makeRawQuotationCart({ status })],
        });

        const result = await quotesService.listQuotes(
          'org-1',
          undefined,
          undefined,
          mockEvent,
        );

        expect(result.quotes[0]?.status).toBe('unknown');
      },
    );

    it('sorts quotes newest first by createdAt', async () => {
      // Scrambled createdAt order from the API (mid, old, new).
      const carts = [
        makeRawQuotationCart({
          quotationNumber: 'Q-MID',
          createdAt: '2026-03-10T08:00:00Z',
        }),
        makeRawQuotationCart({
          quotationNumber: 'Q-OLD',
          createdAt: '2026-01-15T08:00:00Z',
        }),
        makeRawQuotationCart({
          quotationNumber: 'Q-NEW',
          createdAt: '2026-05-20T08:00:00Z',
        }),
      ];
      mockGraphqlQuery.mockResolvedValueOnce({ listQuotationCarts: carts });

      const result = await quotesService.listQuotes('org-1', 0, 10, mockEvent);

      expect(result.quotes.map((q) => q.quoteNumber)).toEqual([
        'Q-NEW',
        'Q-MID',
        'Q-OLD',
      ]);
    });

    it('sorts quotes with empty or invalid createdAt last', async () => {
      const carts = [
        makeRawQuotationCart({ quotationNumber: 'Q-EMPTY', createdAt: '' }),
        makeRawQuotationCart({
          quotationNumber: 'Q-NEW',
          createdAt: '2026-05-20T08:00:00Z',
        }),
        makeRawQuotationCart({
          quotationNumber: 'Q-MID',
          createdAt: '2026-03-10T08:00:00Z',
        }),
      ];
      mockGraphqlQuery.mockResolvedValueOnce({ listQuotationCarts: carts });

      const result = await quotesService.listQuotes('org-1', 0, 10, mockEvent);

      expect(result.quotes.map((q) => q.quoteNumber)).toEqual([
        'Q-NEW',
        'Q-MID',
        'Q-EMPTY',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // getQuote
  // -------------------------------------------------------------------------
  describe('getQuote', () => {
    it('fails as not found when Geins answers no quotation', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: null });

      await expect(
        quotesService.getQuote('cart-404', mockEvent),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Quote cart-404 not found',
      });
    });

    it('reads through the quotes service, without a user token when the request carries none', async () => {
      const sdk = await import('../../../server/services/_sdk');
      vi.mocked(sdk.buildRequestContext).mockReturnValueOnce(
        undefined as never,
      );
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart(),
      });

      await quotesService.getQuote('cart-001', mockEvent);

      expect(mockGraphqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({ userToken: undefined }),
      );
      expect(vi.mocked(wrapServiceCall).mock.calls.at(-1)?.[1]).toBe('quotes');
    });

    it("gives a line its product page's canonical path, and none when Geins sends none", async () => {
      const cart = makeRawQuotationCart();
      const [item] = cart.items as Record<string, unknown>[];
      cart.items = [
        {
          ...item,
          product: {
            ...(item!.product as object),
            canonicalUrl: '/skopor/digging-bucket',
          },
        },
        {
          ...item,
          id: 'item-002',
          product: { productId: 7, canonicalUrl: null },
        },
      ];
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const { lineItems } = await quotesService.getQuote('cart-001', mockEvent);

      expect(lineItems[0]!.canonicalUrl).toBe('/skopor/digging-bucket');
      expect(lineItems[1]).not.toHaveProperty('canonicalUrl');
    });

    it('gives the order a finalized quotation placed', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart({
          status: 'FINALIZED',
          orderId: '1712',
        }),
      });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.orderId).toBe('1712');
    });

    it("gives a finalized quotation its order's public id, looked up by the number", async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart({
          status: 'FINALIZED',
          orderId: '1712',
        }),
      });
      mockFindOrderPublicId.mockResolvedValueOnce('pub-1712');

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(mockFindOrderPublicId).toHaveBeenCalledWith(1712, mockEvent);
      expect(result.orderPublicId).toBe('pub-1712');
    });

    it("takes the order's public id from the quotation, without looking it up", async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart({
          status: 'FINALIZED',
          orderId: '1712',
          orderPublicId: 'pub-from-quotation',
        }),
      });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(mockFindOrderPublicId).not.toHaveBeenCalled();
      expect(result.orderPublicId).toBe('pub-from-quotation');
    });

    it.each([null, ''])(
      'looks the public id up by the number when the quotation carries %j',
      async (orderPublicId) => {
        mockGraphqlQuery.mockResolvedValueOnce({
          getQuotationCart: makeRawQuotationCart({
            status: 'FINALIZED',
            orderId: '1712',
            orderPublicId,
          }),
        });
        mockFindOrderPublicId.mockResolvedValueOnce('pub-1712');

        const result = await quotesService.getQuote('cart-001', mockEvent);

        expect(mockFindOrderPublicId).toHaveBeenCalledWith(1712, mockEvent);
        expect(result.orderPublicId).toBe('pub-1712');
      },
    );

    it('leaves the public id out while the order is not readable', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart({
          status: 'FINALIZED',
          orderId: '1712',
        }),
      });
      mockFindOrderPublicId.mockResolvedValueOnce(undefined);

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.orderId).toBe('1712');
      expect(result).not.toHaveProperty('orderPublicId');
    });

    it('still answers the quotation when the order lookup fails', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart({
          status: 'FINALIZED',
          orderId: '1712',
        }),
      });
      mockFindOrderPublicId.mockRejectedValueOnce(new Error('Geins down'));

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.orderId).toBe('1712');
      expect(result).not.toHaveProperty('orderPublicId');
    });

    it('looks up no order for a quotation without one', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart(),
      });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(mockFindOrderPublicId).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('orderPublicId');
    });

    it('gives a quotation without an order no order id', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart(),
      });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result).not.toHaveProperty('orderId');
    });

    it('gives a line without a library image no image url', async () => {
      const cart = makeRawQuotationCart();
      const [item] = cart.items as Record<string, unknown>[];
      cart.items = [
        { ...item, product: undefined },
        { ...item, product: { productId: 101 } },
        { ...item, product: { productId: 101, productImages: [] } },
        {
          ...item,
          product: {
            productId: 101,
            productImages: [{ fileName: 'old.jpg', url: null }],
          },
        },
      ];
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.lineItems.map((line) => line.imageUrl)).toEqual([
        null,
        null,
        null,
        null,
      ]);
      expect(result.lineItems[3]!.imageFileName).toBe('old.jpg');
    });

    describe('a configured line', () => {
      const unitPrice = {
        sellingPriceIncVat: 29256.7,
        sellingPriceIncVatFormatted: '29 256,70 kr',
        sellingPriceExVat: 23405.36,
        sellingPriceExVatFormatted: '23 405,36 kr',
        vat: 5851.34,
        currency: { code: 'SEK' },
      };
      const optionPrice = {
        sellingPriceIncVat: 1250,
        sellingPriceExVat: 1000,
        vat: 250,
        currency: { code: 'SEK' },
      };
      const configuration = {
        committedConfigurationId: 'committed-1',
        summary: [
          { label: 'Display', value: '55"' },
          { label: 'Warranty', value: null },
        ],
        sections: [
          {
            id: 'section-1',
            name: 'Configuration',
            sortIndex: 1,
            variables: [],
            optionGroups: [
              {
                id: 'group-1',
                code: 'DISPLAY',
                name: 'Display',
                sortIndex: 1,
                options: [
                  {
                    id: 'option-1',
                    instanceId: 'instance-1',
                    articleNumber: 'D55',
                    name: '55" panel',
                    quantity: 1,
                    unitPrice: optionPrice,
                    discountPercent: 0,
                  },
                ],
                optionGroups: [],
              },
            ],
            sections: [],
          },
        ],
      };

      async function readLines(...items: Record<string, unknown>[]) {
        const cart = makeRawQuotationCart();
        const [item] = cart.items as Record<string, unknown>[];
        cart.items = items.map((overrides) => ({ ...item, ...overrides }));
        mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });
        return (await quotesService.getQuote('cart-001', mockEvent)).lineItems;
      }

      it('gives a line without an id or SKU empty ones', async () => {
        const [bare] = await readLines({ id: undefined, skuId: undefined });

        expect(bare).toMatchObject({ id: '', skuId: 0 });
      });

      it('carries a line message, which is sent back with the line', async () => {
        const [plain, noted] = await readLines({}, { message: 'Montering' });

        expect(plain).not.toHaveProperty('message');
        expect(noted!.message).toBe('Montering');
      });

      it('carries the configuration it was committed with and its prices', async () => {
        const [line] = await readLines({
          configurationId: 'config-1',
          configuration,
          unitPrice,
          totalPrice: unitPrice,
        });

        expect(line!.configuration).toEqual({
          configurationId: 'config-1',
          summary: [
            { label: 'Display', value: '55"' },
            { label: 'Warranty', value: '' },
          ],
          sections: [
            {
              name: 'Configuration',
              sortIndex: 1,
              variables: [],
              optionGroups: [
                {
                  id: 'group-1',
                  name: 'Display',
                  sortIndex: 1,
                  options: [
                    { name: '55" panel', quantity: 1, unitPrice: optionPrice },
                  ],
                  optionGroups: [],
                },
              ],
              sections: [],
            },
          ],
        });
        expect(line!.linePrices).toEqual({
          unit: unitPrice,
          total: unitPrice,
        });
      });

      it('is still configured when Geins sends the id without the configuration', async () => {
        const [line] = await readLines({
          configurationId: 'config-1',
          configuration: null,
        });

        expect(line!.configuration).toEqual({
          configurationId: 'config-1',
          summary: [],
        });
      });

      it('leaves an ordinary line without a configuration or line prices', async () => {
        const [plain, nullId] = await readLines(
          {},
          { configurationId: null, configuration: null },
        );

        for (const line of [plain!, nullId!]) {
          expect(line).not.toHaveProperty('configuration');
          expect(line).not.toHaveProperty('linePrices');
        }
      });

      it('keeps two configurations of one SKU as two lines', async () => {
        const lines = await readLines(
          { configurationId: 'config-1', configuration },
          { configurationId: 'config-2', configuration },
        );

        expect(
          lines.map((line) => [
            line.skuId,
            line.configuration?.configurationId,
          ]),
        ).toEqual([
          [501, 'config-1'],
          [501, 'config-2'],
        ]);
      });
    });

    it('calls graphql.query with getQuotationCart and maps to Quote type', async () => {
      const cart = makeRawQuotationCart();
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(mockGraphqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: 'query:quotes/get-quotation.graphql',
          userToken: 'test-user-token',
          variables: {
            quotationId: 'cart-001',
            languageId: 'sv-SE',
          },
        }),
      );

      expect(result).toMatchObject({
        id: 'cart-001',
        quoteNumber: 'Q-20260101001',
        status: 'pending',
        currency: 'SEK',
        total: 10039,
        totalFormatted: kr('10 039,00 kr'),
        subtotal: 9990,
        subtotalFormatted: kr('9 990,00 kr'),
        tax: 2007.8,
        taxFormatted: kr('2 007,80 kr'),
        shipping: 49,
        shippingFormatted: kr('49,00 kr'),
        subtotalExVat: 7992,
        subtotalExVatFormatted: kr('7 992,00 kr'),
        shippingExVat: 39.2,
        shippingExVatFormatted: kr('39,20 kr'),
        totalExVat: 8031.2,
        totalExVatFormatted: kr('8 031,20 kr'),
        createdAt: '2026-03-01T10:15:00Z',
        updatedAt: '2026-03-01T10:15:00Z',
        expiresAt: '2026-04-01T00:00:00Z',
        contactName: 'Lisa Andersson',
        contactEmail: 'lisa@acmecorp.se',
        createdBy: 'owner-1',
        paymentTerms: 'Net 30',
      });

      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0]).toMatchObject({
        productId: 101,
        id: 'item-001',
        skuId: 501,
        name: 'Standing Desk Oak Large',
        articleNumber: 'SD-OAK-L',
        quantity: 2,
        unitPrice: 4995,
        unitPriceFormatted: kr('4 995,00 kr'),
        totalPrice: 9990,
        totalPriceFormatted: kr('9 990,00 kr'),
        unitPriceExVat: 3996,
        unitPriceExVatFormatted: kr('3 996,00 kr'),
        totalPriceExVat: 7992,
        totalPriceExVatFormatted: kr('7 992,00 kr'),
        imageFileName: '/img/desk.jpg',
        imageUrl: 'https://cdn.example.test/acme/products/desk.jpg',
      });

      expect(result.company).toEqual({
        companyId: 'comp-1',
        name: 'Acme Corp',
        vatNumber: 'SE12345',
      });

      expect(result.billingAddress).toEqual({
        email: 'lisa@acmecorp.se',
        phone: '+46123456',
        company: 'Acme Corp',
        firstName: 'Lisa',
        lastName: 'Andersson',
        addressLine1: 'Street 1',
        addressLine2: undefined,
        addressLine3: undefined,
        zip: '11122',
        city: 'Stockholm',
        region: undefined,
        country: 'SE',
      });

      expect(result.shippingAddress).toEqual({
        email: 'delivery@acmecorp.se',
        phone: '+46987654',
        company: 'Acme Corp Warehouse',
        firstName: 'Warehouse',
        lastName: 'Receiver',
        addressLine1: 'Industrivagen 5',
        addressLine2: 'Building B',
        addressLine3: undefined,
        zip: '55533',
        city: 'Goteborg',
        region: undefined,
        country: 'SE',
      });
    });

    it("gives whole amounts two decimals, where Geins' strings have none", async () => {
      const cart = makeRawQuotationCart();
      const items = cart.items as Array<Record<string, unknown>>;
      items[0]!.quantity = 360;
      items[0]!.unitPrice = {
        sellingPriceIncVat: 5,
        sellingPriceIncVatFormatted: '5 kr',
        sellingPriceExVat: 4,
        sellingPriceExVatFormatted: '4 kr',
      };
      items[0]!.totalPrice = {
        sellingPriceIncVat: 1800,
        sellingPriceIncVatFormatted: '1 800 kr',
        sellingPriceExVat: 1440,
        sellingPriceExVatFormatted: '1 440 kr',
      };
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.lineItems[0]).toMatchObject({
        unitPriceFormatted: kr('5,00 kr'),
        unitPriceExVatFormatted: kr('4,00 kr'),
        totalPriceFormatted: kr('1 800,00 kr'),
        totalPriceExVatFormatted: kr('1 440,00 kr'),
      });
    });

    it("keeps Geins' strings when the quotation carries no currency", async () => {
      const cart = makeRawQuotationCart({ currency: null });
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result).toMatchObject({
        subtotalFormatted: '9 990 SEK',
        taxFormatted: '2 007,80 SEK',
        shippingFormatted: '49 SEK',
        totalFormatted: '10 039 SEK',
        totalExVatFormatted: '8 031 SEK',
      });
      expect(result.lineItems[0]).toMatchObject({
        unitPriceFormatted: '4 995 SEK',
        totalPriceExVatFormatted: '7 992 SEK',
      });
    });

    it('returns undefined for shippingAddress when raw shippingAddress is null', async () => {
      const cart = makeRawQuotationCart({ shippingAddress: null });
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.shippingAddress).toBeUndefined();
      // Billing still populated even when shipping is missing
      expect(result.billingAddress).toBeDefined();
      expect(result.billingAddress?.addressLine1).toBe('Street 1');
    });

    it('reads a quotation Geins answers without lines as one with none', async () => {
      const cart = makeRawQuotationCart();
      cart.items = null;
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.lineItems).toEqual([]);
    });

    it('defaults shipping to 0 and empty string when summary.shipping is missing', async () => {
      const cart = makeRawQuotationCart();
      // Remove shipping from summary to simulate Geins response without shipping
      delete (cart.summary as Record<string, unknown>).shipping;
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.shipping).toBe(0);
      expect(result.shippingFormatted).toBe('');
    });

    it('leaves the ex-VAT amounts empty, never the inc ones, when the API omits them', async () => {
      const cart = makeRawQuotationCart();
      const items = cart.items as Array<Record<string, unknown>>;
      items[0]!.unitPrice = { sellingPriceIncVat: 4995 };
      items[0]!.totalPrice = { sellingPriceIncVat: 9990 };
      cart.summary = {
        subTotal: { sellingPriceIncVat: 9990 },
        shipping: { feeIncVat: 49 },
        total: { sellingPriceIncVat: 10039 },
      };
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result).toMatchObject({
        subtotalExVat: 0,
        subtotalExVatFormatted: '',
        shippingExVat: 0,
        shippingExVatFormatted: '',
        totalExVat: 0,
        totalExVatFormatted: '',
      });
      expect(result.lineItems[0]).toMatchObject({
        unitPriceExVat: 0,
        unitPriceExVatFormatted: '',
        totalPriceExVat: 0,
        totalPriceExVatFormatted: '',
      });
    });

    it.each([
      ['no summary', undefined],
      ['an empty summary', {}],
    ])(
      'maps a quotation with %s and unpriced lines to empty ex-VAT amounts',
      async (_, summary) => {
        const cart = makeRawQuotationCart();
        const items = cart.items as Array<Record<string, unknown>>;
        delete items[0]!.unitPrice;
        delete items[0]!.totalPrice;
        cart.summary = summary;
        mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

        const result = await quotesService.getQuote('cart-001', mockEvent);

        expect(result).toMatchObject({
          subtotalExVat: 0,
          subtotalExVatFormatted: '',
          shippingExVat: 0,
          shippingExVatFormatted: '',
          totalExVat: 0,
          totalExVatFormatted: '',
        });
        expect(result.lineItems[0]).toMatchObject({
          unitPriceExVat: 0,
          unitPriceExVatFormatted: '',
          totalPriceExVat: 0,
          totalPriceExVatFormatted: '',
        });
      },
    );

    it('reads VAT from the total, which carries the shipping and the discount', async () => {
      const cart = makeRawQuotationCart();
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      // The subtotal's VAT (1 998) leaves out the shipping's.
      expect(result.tax).toBe(2007.8);
      expect(result.taxFormatted).toBe(kr('2 007,80 kr'));
    });

    it('leaves the VAT empty when the total carries none', async () => {
      const cart = makeRawQuotationCart();
      const summary = cart.summary as { total: Record<string, unknown> };
      delete summary.total.vat;
      delete summary.total.vatFormatted;
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.tax).toBe(0);
      expect(result.taxFormatted).toBe('');
    });

    it.each([
      [
        'a percent discount, with its rate',
        { type: 'Percent', value: 5 },
        [204.3625, 163.49],
        { discount: 204.3625, discountExVat: 163.49, discountPercent: 5 },
      ],
      [
        'a fixed discount, without a rate',
        { type: 'FixedAmount', value: 50 },
        [62.5, 50],
        { discount: 62.5, discountExVat: 50, discountPercent: undefined },
      ],
      [
        'no discount',
        { type: null, value: 0 },
        [0, 0],
        { discount: 0, discountExVat: 0, discountPercent: undefined },
      ],
    ])(
      'maps %s as the API gives it',
      async (_, discount, [incVat, exVat], expected) => {
        const cart = makeRawQuotationCart({ discount });
        Object.assign(cart.summary as Record<string, unknown>, {
          fixedAmountDiscountIncVat: incVat,
          fixedAmountDiscountExVat: exVat,
        });
        mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

        const result = await quotesService.getQuote('cart-001', mockEvent);

        expect({
          discount: result.discount,
          discountExVat: result.discountExVat,
          discountPercent: result.discountPercent,
        }).toEqual(expected);
      },
    );

    it('maps a quotation the API sends no discount for to none', async () => {
      const cart = makeRawQuotationCart();
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect({
        discount: result.discount,
        discountExVat: result.discountExVat,
        discountPercent: result.discountPercent,
      }).toEqual({ discount: 0, discountExVat: 0, discountPercent: undefined });
    });

    it('maps quotation.name to Quote.name (proposal title)', async () => {
      const cart = makeRawQuotationCart({ name: 'Dec order proposal' });
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.name).toBe('Dec order proposal');
      expect(
        (result as unknown as { message?: string }).message,
      ).toBeUndefined();
    });

    describe('what the order page reads', () => {
      async function getMapped(overrides: Record<string, unknown> = {}) {
        mockGraphqlQuery.mockResolvedValueOnce({
          getQuotationCart: makeRawQuotationCart(overrides),
        });
        return quotesService.getQuote('cart-001', mockEvent);
      }

      it('maps the valid payment methods in their order', async () => {
        const quote = await getMapped({
          validPaymentMethods: [
            { paymentId: '18', name: 'ManualInvoice', paymentFee: 0 },
            { paymentId: '23', name: 'Card', paymentFee: 12.5 },
          ],
        });
        expect(quote.paymentMethods).toEqual([
          { id: '18', name: 'ManualInvoice', fee: 0 },
          { id: '23', name: 'Card', fee: 12.5 },
        ]);
      });

      it('reads an empty or missing name and fee as undefined, a missing id as empty', async () => {
        const quote = await getMapped({
          validPaymentMethods: [
            { paymentId: '18', name: '', paymentFee: null },
            { paymentId: '19' },
            { paymentId: null, name: 'Card' },
          ],
        });
        expect(quote.paymentMethods).toEqual([
          { id: '18', name: undefined, fee: undefined },
          { id: '19', name: undefined, fee: undefined },
          { id: '', name: 'Card', fee: undefined },
        ]);
      });

      it.each([null, undefined, []])(
        'gives %j as no payment methods',
        async (validPaymentMethods) => {
          const quote = await getMapped({ validPaymentMethods });
          expect(quote.paymentMethods).toBeUndefined();
        },
      );

      it('reads the buyer from the customer alone', async () => {
        const quote = await getMapped({
          customer: {
            customerId: 'buyer@acme.test',
            firstName: 'Anna',
            lastName: 'Berg',
          },
        });
        expect(quote.customer).toEqual({
          id: 'buyer@acme.test',
          firstName: 'Anna',
          lastName: 'Berg',
        });
      });

      it('never names the seller as the buyer', async () => {
        const quote = await getMapped({
          customer: {
            customerId: 'buyer@acme.test',
            firstName: '',
            lastName: null,
          },
        });
        expect(quote.customer).toEqual({
          id: 'buyer@acme.test',
          firstName: undefined,
          lastName: undefined,
        });
      });

      it.each([null, undefined])(
        'gives a %s customer no buyer',
        async (customer) => {
          const quote = await getMapped({ customer });
          expect(quote.customer).toBeUndefined();
        },
      );

      it("reads the payment method's display name", async () => {
        const quote = await getMapped({
          validPaymentMethods: [
            { paymentId: '18', name: 'ManualInvoice', displayName: 'Faktura' },
            { paymentId: '19', name: 'Card', displayName: '' },
            { paymentId: '20', name: 'Old', displayName: null },
          ],
        });
        expect(quote.paymentMethods?.map((m) => m.displayName)).toEqual([
          'Faktura',
          undefined,
          undefined,
        ]);
      });

      describe('the order details the order gets', () => {
        it('reads them from orderDetails, the date as its day', async () => {
          const quote = await getMapped({
            orderDetails: {
              customerOrderNumber: 'PO-1',
              customerReference: 'Anna',
              desiredDeliveryDate: '2026-12-15T00:00:00+00:00',
              goodsLabel: 'Dock B',
            },
            request: {
              customerOrderNumber: 'PO-OLD',
              desiredDeliveryDate: '2026-12-01T00:00:00+00:00',
              goodsLabel: 'Old label',
            },
          });
          expect(quote.orderDetails).toEqual({
            customerOrderNumber: 'PO-1',
            desiredDeliveryDate: '2026-12-15',
            goodsLabel: 'Dock B',
          });
        });

        it('reads an orderDetails field left empty as missing, never from the request', async () => {
          const quote = await getMapped({
            orderDetails: {
              customerOrderNumber: '',
              desiredDeliveryDate: null,
              goodsLabel: 'Dock B',
            },
            request: { customerOrderNumber: 'PO-OLD' },
          });
          expect(quote.orderDetails).toEqual({
            customerOrderNumber: undefined,
            desiredDeliveryDate: undefined,
            goodsLabel: 'Dock B',
          });
        });

        it('falls back to the request when the quotation has no orderDetails', async () => {
          const quote = await getMapped({
            orderDetails: null,
            request: {
              customerOrderNumber: 'PO-2',
              customerReference: 'ref',
              desiredDeliveryDate: '2026-11-30T00:00:00Z',
              goodsLabel: '',
            },
          });
          expect(quote.orderDetails).toEqual({
            customerOrderNumber: 'PO-2',
            desiredDeliveryDate: '2026-11-30',
            goodsLabel: undefined,
          });
        });

        it("takes an older request's reference as the PO number, as finalize does", async () => {
          const quote = await getMapped({
            orderDetails: null,
            request: { customerReference: 'PO-77', customerOrderNumber: '' },
          });
          expect(quote.orderDetails?.customerOrderNumber).toBe('PO-77');
        });

        it('reads a date it cannot read as no date', async () => {
          const quote = await getMapped({
            orderDetails: { desiredDeliveryDate: 'soon', goodsLabel: 'Dock B' },
          });
          expect(quote.orderDetails?.desiredDeliveryDate).toBeUndefined();
        });

        it.each([
          ['neither', {}],
          ['both null', { orderDetails: null, request: null }],
          [
            'only empty values',
            { orderDetails: null, request: { customerReference: '' } },
          ],
        ])('has none with %s', async (_label, overrides) => {
          const quote = await getMapped(overrides);
          expect(quote.orderDetails).toBeUndefined();
        });
      });

      describe('what the buyer sent', () => {
        it('reads all four from the request, never from orderDetails', async () => {
          const quote = await getMapped({
            orderDetails: {
              customerOrderNumber: 'PO-SELLER',
              desiredDeliveryDate: '2027-01-10T00:00:00+00:00',
              goodsLabel: 'Seller label',
            },
            request: {
              comment: 'Leverans till lager 2\nPorten på baksidan',
              customerOrderNumber: 'PO-7781',
              customerReference: 'Anna',
              desiredDeliveryDate: '2026-12-09T00:00:00+00:00',
              goodsLabel: 'Lastbrygga B',
            },
          });
          expect(quote.request).toEqual({
            comment: 'Leverans till lager 2\nPorten på baksidan',
            customerOrderNumber: 'PO-7781',
            desiredDeliveryDate: '2026-12-09',
            goodsLabel: 'Lastbrygga B',
          });
        });

        it('reads the fields that are set and leaves the empty ones out', async () => {
          const quote = await getMapped({
            request: {
              comment: '',
              customerOrderNumber: null,
              desiredDeliveryDate: '2026-12-09T00:00:00Z',
              goodsLabel: 'Dock B',
            },
          });
          expect(quote.request).toEqual({
            comment: undefined,
            customerOrderNumber: undefined,
            desiredDeliveryDate: '2026-12-09',
            goodsLabel: 'Dock B',
          });
        });

        it("takes an older request's reference as the PO number", async () => {
          const quote = await getMapped({
            request: { customerReference: 'PO-77', customerOrderNumber: '' },
          });
          expect(quote.request?.customerOrderNumber).toBe('PO-77');
        });

        it('reads a date it cannot read as no date', async () => {
          const quote = await getMapped({
            // Only a value that starts with its day is read as one.
            request: { desiredDeliveryDate: 'by 2026-12-09', comment: 'Hej' },
          });
          expect(quote.request).toEqual({
            comment: 'Hej',
            customerOrderNumber: undefined,
            desiredDeliveryDate: undefined,
            goodsLabel: undefined,
          });
        });

        it.each([
          ['no request', {}],
          ['a null request', { request: null }],
          [
            'only empty values',
            {
              request: {
                comment: '',
                customerOrderNumber: '',
                customerReference: '',
                desiredDeliveryDate: null,
                goodsLabel: '',
              },
            },
          ],
          [
            'only orderDetails',
            { orderDetails: { customerOrderNumber: 'PO-1' }, request: null },
          ],
        ])('has none with %s', async (_label, overrides) => {
          const quote = await getMapped(overrides);
          expect(quote.request).toBeUndefined();
        });
      });
    });

    describe('what the buyer may do and who answers for the seller', () => {
      async function getMapped(overrides: Record<string, unknown> = {}) {
        mockGraphqlQuery.mockResolvedValueOnce({
          getQuotationCart: makeRawQuotationCart(overrides),
        });
        return quotesService.getQuote('cart-001', mockEvent);
      }

      it.each([
        [{ requireConfirmation: true }, true],
        [{ requireConfirmation: false }, false],
        [{ requireConfirmation: null }, false],
        [null, false],
      ])(
        'maps settings %j to requiresConfirmation %s',
        async (settings, expected) => {
          const quote = await getMapped({ settings });
          expect(quote.requiresConfirmation).toBe(expected);
        },
      );

      it('names the seller from the owner, never the buyer', async () => {
        const quote = await getMapped({
          owner: {
            ownerId: 'owner-1',
            firstName: 'Sam',
            lastName: 'Seller',
            phone: '+4670000',
          },
          customer: { firstName: 'Bo', lastName: 'Buyer', approvedAt: null },
        });
        expect(quote.seller).toEqual({ name: 'Sam Seller', phone: '+4670000' });
      });

      it('leaves the seller out when the owner has no name', async () => {
        const quote = await getMapped({
          owner: {
            ownerId: 'owner-1',
            firstName: '',
            lastName: null,
            phone: '+46',
          },
        });
        expect(quote.seller).toBeUndefined();
      });

      it('has no seller when the quotation carries no owner', async () => {
        const quote = await getMapped({ owner: undefined });
        expect(quote.seller).toBeUndefined();
      });

      it('says nothing about accepting when the quotation carries no customer', async () => {
        const quote = await getMapped({ customer: undefined });
        expect({ at: quote.acceptedAt, by: quote.acceptedBy }).toEqual({
          at: undefined,
          by: undefined,
        });
      });

      it('gives a seller without a phone no phone', async () => {
        const quote = await getMapped({
          owner: { firstName: 'Sam', lastName: '', phone: '' },
        });
        expect(quote.seller).toEqual({ name: 'Sam', phone: undefined });
      });

      it('says when and by whom it was accepted, once the API sets it', async () => {
        const quote = await getMapped({
          customer: {
            firstName: 'Bo',
            lastName: 'Buyer',
            approvedAt: '2026-10-28T09:00:00+00:00',
          },
        });
        expect({ at: quote.acceptedAt, by: quote.acceptedBy }).toEqual({
          at: '2026-10-28T09:00:00+00:00',
          by: 'Bo Buyer',
        });
      });

      it('says nothing about accepting while approvedAt is not set', async () => {
        const quote = await getMapped({
          status: 'ACCEPTED',
          customer: { firstName: 'Bo', lastName: 'Buyer', approvedAt: null },
        });
        expect({ at: quote.acceptedAt, by: quote.acceptedBy }).toEqual({
          at: undefined,
          by: undefined,
        });
      });
    });

    it('throws when quotation cart is not found', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: null });

      await expect(
        quotesService.getQuote('nonexistent', mockEvent),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // acceptQuote / rejectQuote / finalizeQuote
  // -------------------------------------------------------------------------
  // Geins answers all three mutations with a Boolean; the quotation is read again
  // with getQuotationCart for the page.
  describe.each([
    {
      action: 'acceptQuote' as const,
      field: 'acceptQuotation',
      file: 'quotes/accept-quotation.graphql',
      rawStatus: 'ACCEPTED',
      status: 'accepted',
    },
    {
      action: 'rejectQuote' as const,
      field: 'rejectQuotation',
      file: 'quotes/reject-quotation.graphql',
      rawStatus: 'REJECTED',
      status: 'rejected',
    },
    {
      action: 'finalizeQuote' as const,
      field: 'finalizeQuotation',
      file: 'quotes/finalize-quotation.graphql',
      rawStatus: 'FINALIZED',
      status: 'finalized',
    },
  ])('$action', ({ action, field, file, rawStatus, status }) => {
    it('asks for no timeout: a write may finish upstream after a cut', async () => {
      mockGraphqlMutation.mockResolvedValueOnce({ [field]: true });
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart({ status: rawStatus }),
      });

      await quotesService[action]('cart-001', mockEvent);

      expect(mockGraphqlMutation.mock.calls[0]![0]).toMatchObject({
        requestOptions: { context: { timeoutMs: 0 } },
      });
    });

    it('on true, returns the quotation read again with its new status', async () => {
      mockGraphqlMutation.mockResolvedValueOnce({ [field]: true });
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart({ status: rawStatus }),
      });

      const result = await quotesService[action]('cart-001', mockEvent);

      expect(mockGraphqlMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: `query:${file}`,
          userToken: 'test-user-token',
          variables: { quotationId: 'cart-001', languageId: 'sv-SE' },
        }),
      );
      expect(mockGraphqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: 'query:quotes/get-quotation.graphql',
          userToken: 'test-user-token',
          variables: { quotationId: 'cart-001', languageId: 'sv-SE' },
        }),
      );
      expect(result.id).toBe('cart-001');
      expect(result.status).toBe(status);
    });

    it.each([false, null])(
      'on %s, fails as an external API error without reading again',
      async (answer) => {
        mockGraphqlMutation.mockResolvedValueOnce({ [field]: answer });

        await expect(
          quotesService[action]('cart-001', mockEvent),
        ).rejects.toMatchObject({ code: 'EXTERNAL_API_ERROR' });
        expect(mockGraphqlQuery).not.toHaveBeenCalled();
      },
    );

    it('passes a Geins error on without reading again', async () => {
      const geinsError = new Error('Geins refused');
      mockGraphqlMutation.mockRejectedValueOnce(geinsError);

      await expect(quotesService[action]('cart-001', mockEvent)).rejects.toBe(
        geinsError,
      );
      expect(mockGraphqlQuery).not.toHaveBeenCalled();
    });
  });

  describe('getQuoteNumber', () => {
    it("reads only the quotation's number, as the signed-in buyer", async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: {
          id: 'cart-001',
          quotation: { quotationNumber: '2611-2-0015-00' },
        },
      });

      const number = await quotesService.getQuoteNumber('cart-001', mockEvent);

      expect(mockGraphqlQuery).toHaveBeenCalledWith({
        queryAsString: 'query:quotes/quotation-number.graphql',
        variables: { quotationId: 'cart-001', languageId: 'sv-SE' },
        userToken: 'test-user-token',
      });
      expect(wrapServiceCall).toHaveBeenCalledWith(
        expect.any(Function),
        'quotes',
      );
      expect(number).toBe('2611-2-0015-00');
    });

    it.each([
      ['no quotation', null],
      ['a cart without its quotation', { id: 'cart-001' }],
      ['a quotation without a number', { id: 'cart-001', quotation: {} }],
      [
        'an empty number',
        { id: 'cart-001', quotation: { quotationNumber: '' } },
      ],
    ])('answers not found for %s', async (_label, answer) => {
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: answer });

      await expect(
        quotesService.getQuoteNumber('cart-001', mockEvent),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('cart-001'),
      });
    });

    it('sends no user token when the request carries no context', async () => {
      const { buildRequestContext } =
        await import('../../../server/services/_sdk');
      vi.mocked(buildRequestContext).mockReturnValueOnce(undefined);
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: {
          id: 'cart-001',
          quotation: { quotationNumber: 'Q-1' },
        },
      });

      await quotesService.getQuoteNumber('cart-001', mockEvent);

      expect(mockGraphqlQuery.mock.calls[0]![0].userToken).toBeUndefined();
    });
  });

  // The order message travels as checkout input on the quotation's cart, which
  // finalize then puts on the order.
  describe('finalizeQuote with an order message', () => {
    function finalizes() {
      mockGraphqlMutation
        .mockResolvedValueOnce({ createOrUpdateCheckout: { message: 'x' } })
        .mockResolvedValueOnce({ finalizeQuotation: true });
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart({ status: 'FINALIZED' }),
      });
    }

    it('writes the message on the quotation cart, then finalizes', async () => {
      finalizes();

      const result = await quotesService.finalizeQuote('cart-001', mockEvent, {
        message: '  Ring innan leverans  ',
      });

      const [checkout, finalize] = mockGraphqlMutation.mock.calls.map(
        ([options]) => options,
      );
      expect(checkout).toMatchObject({
        queryAsString: 'query:quotes/quotation-checkout.graphql',
        userToken: 'test-user-token',
        variables: {
          cartId: 'cart-001',
          checkout: { message: 'Ring innan leverans' },
          channelId: '1|se',
          languageId: 'sv-SE',
          marketId: 'se',
        },
        requestOptions: { context: { timeoutMs: 0 } },
      });
      expect(Object.keys(checkout.variables.checkout)).toEqual(['message']);
      expect(finalize).toMatchObject({
        queryAsString: 'query:quotes/finalize-quotation.graphql',
      });
      expect(result.status).toBe('finalized');
    });

    it('finalizes alone without a message', async () => {
      mockGraphqlMutation.mockResolvedValueOnce({ finalizeQuotation: true });
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: makeRawQuotationCart({ status: 'FINALIZED' }),
      });

      await quotesService.finalizeQuote('cart-001', mockEvent, {});

      expect(mockGraphqlMutation).toHaveBeenCalledTimes(1);
      expect(mockGraphqlMutation.mock.calls[0]![0]).toMatchObject({
        queryAsString: 'query:quotes/finalize-quotation.graphql',
      });
    });

    it.each(['', '   '])(
      'writes the blank message %j as empty, which clears one written before',
      async (message) => {
        finalizes();

        await quotesService.finalizeQuote('cart-001', mockEvent, { message });

        expect(mockGraphqlMutation.mock.calls[0]![0]).toMatchObject({
          queryAsString: 'query:quotes/quotation-checkout.graphql',
          variables: { checkout: { message: '' } },
        });
        expect(mockGraphqlMutation.mock.calls[1]![0]).toMatchObject({
          queryAsString: 'query:quotes/finalize-quotation.graphql',
        });
      },
    );

    it('places no order when the message is refused', async () => {
      const refused = new Error('message too long');
      mockGraphqlMutation.mockRejectedValueOnce(refused);

      await expect(
        quotesService.finalizeQuote('cart-001', mockEvent, { message: 'Hej' }),
      ).rejects.toBe(refused);
      expect(mockGraphqlMutation).toHaveBeenCalledTimes(1);
      expect(mockGraphqlQuery).not.toHaveBeenCalled();
    });

    it('places no order when Geins answers the checkout with nothing', async () => {
      mockGraphqlMutation.mockResolvedValueOnce({
        createOrUpdateCheckout: null,
      });

      await expect(
        quotesService.finalizeQuote('cart-001', mockEvent, { message: 'Hej' }),
      ).rejects.toMatchObject({
        code: 'EXTERNAL_API_ERROR',
        message: expect.stringContaining('cart-001'),
      });
      expect(mockGraphqlMutation).toHaveBeenCalledTimes(1);
    });

    it('names the quotes service for the error mapping', async () => {
      finalizes();

      await quotesService.finalizeQuote('cart-001', mockEvent, {
        message: 'Hej',
      });

      expect(wrapServiceCall).toHaveBeenNthCalledWith(
        1,
        expect.any(Function),
        'quotes',
      );
    });

    it('sends no user token when the request carries no context', async () => {
      const { buildRequestContext } =
        await import('../../../server/services/_sdk');
      vi.mocked(buildRequestContext).mockReturnValueOnce(undefined);
      finalizes();

      await quotesService.finalizeQuote('cart-001', mockEvent, {
        message: 'Hej',
      });

      expect(mockGraphqlMutation.mock.calls[0]![0].userToken).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // createQuoteRequest / updateQuoteRequest / releaseQuoteRequest
  // -------------------------------------------------------------------------
  // Geins answers the request mutations with the quotation's cart, so there is
  // no second read. Shape as measured on a registered tenant: the draft gets
  // its own id, a number at once, and the cart's lines.
  describe('quote requests', () => {
    const draftCart = (status: string) => ({
      ...makeRawQuotationCart({
        status,
        quotationNumber: '2611-2-0001-00',
        name: 'Varukorg 2 nov 2026',
      }),
      id: 'draft-001',
    });

    describe('createQuoteRequest', () => {
      it('creates a draft from the cart and returns it mapped', async () => {
        mockGraphqlMutation.mockResolvedValueOnce({
          createQuotationRequest: draftCart('REQUEST_DRAFT'),
        });

        const result = await quotesService.createQuoteRequest(
          'cart-abc',
          'Varukorg 2 nov 2026',
          mockEvent,
        );

        expect(mockGraphqlMutation).toHaveBeenCalledWith(
          expect.objectContaining({
            queryAsString: 'query:quotes/create-quotation-request.graphql',
            userToken: 'test-user-token',
            variables: {
              request: {
                cartId: 'cart-abc',
                name: 'Varukorg 2 nov 2026',
                draft: true,
              },
              channelId: '1|se',
              languageId: 'sv-SE',
              marketId: 'se',
            },
          }),
        );
        expect(mockGraphqlQuery).not.toHaveBeenCalled();
        expect(result).toMatchObject({
          id: 'draft-001',
          quoteNumber: '2611-2-0001-00',
          status: 'request_draft',
          name: 'Varukorg 2 nov 2026',
          totalFormatted: kr('10 039,00 kr'),
        });
        expect(result.lineItems).toHaveLength(1);
      });
    });

    describe('updateQuoteRequest', () => {
      it('sends the details and never the lines', async () => {
        mockGraphqlMutation.mockResolvedValueOnce({
          updateQuotationRequest: draftCart('REQUEST_DRAFT'),
        });
        const details = {
          comment: 'Leverans till lager B',
          desiredDeliveryDate: '2026-12-15',
          customerOrderNumber: 'PO-7781',
          goodsLabel: 'Lastbrygga B',
        };

        const result = await quotesService.updateQuoteRequest(
          'draft-001',
          details,
          mockEvent,
        );

        const call = mockGraphqlMutation.mock.calls[0]![0];
        expect(call).toMatchObject({
          queryAsString: 'query:quotes/update-quotation-request.graphql',
          userToken: 'test-user-token',
          variables: {
            quotationId: 'draft-001',
            request: {
              comment: 'Leverans till lager B',
              // Geins takes a DateTimeOffset and refuses a bare date as
              // INVALID_VALUE; the day is sent as its UTC midnight.
              desiredDeliveryDate: '2026-12-15T00:00:00Z',
              customerOrderNumber: 'PO-7781',
              goodsLabel: 'Lastbrygga B',
            },
            languageId: 'sv-SE',
          },
        });
        expect(call.variables.request).not.toHaveProperty('items');
        expect(result).toMatchObject({
          id: 'draft-001',
          status: 'request_draft',
        });
      });
    });

    it('sends no date when the buyer gave none', async () => {
      mockGraphqlMutation.mockResolvedValueOnce({
        updateQuotationRequest: draftCart('REQUEST_DRAFT'),
      });

      await quotesService.updateQuoteRequest(
        'draft-001',
        { comment: 'Bara en kommentar' },
        mockEvent,
      );

      expect(mockGraphqlMutation.mock.calls[0]![0].variables.request).toEqual({
        comment: 'Bara en kommentar',
      });
    });

    describe('updateQuoteRequest with a name and lines', () => {
      it('sends the name and the lines as given, without reading the draft first', async () => {
        mockGraphqlMutation.mockResolvedValueOnce({
          updateQuotationRequest: draftCart('REQUEST_DRAFT'),
        });
        const items = [
          { id: 'item-001', skuId: 501, quantity: 3 },
          { skuId: 777, quantity: 1 },
        ];

        await quotesService.updateQuoteRequest(
          'draft-001',
          { name: 'Kontor plan 3', items },
          mockEvent,
        );

        expect(mockGraphqlQuery).not.toHaveBeenCalled();
        expect(mockGraphqlMutation.mock.calls[0]![0].variables).toEqual({
          quotationId: 'draft-001',
          request: { name: 'Kontor plan 3', items },
          languageId: 'sv-SE',
        });
      });

      describe('a configured line', () => {
        /** The draft as Geins holds it: one configured line of 2. */
        function draftWithConfiguredLine() {
          const cart: Record<string, unknown> = draftCart('REQUEST_DRAFT');
          const [item] = cart.items as Record<string, unknown>[];
          cart.items = [
            item,
            {
              ...item,
              id: 'item-002',
              skuId: 900,
              quantity: 2,
              configurationId: 'cfg-1',
            },
          ];
          mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });
        }

        it('is sent when the draft holds it at that amount', async () => {
          draftWithConfiguredLine();
          mockGraphqlMutation.mockResolvedValueOnce({
            updateQuotationRequest: draftCart('REQUEST_DRAFT'),
          });
          const items = [
            {
              id: 'item-002',
              skuId: 900,
              quantity: 2,
              configurationId: 'cfg-1',
            },
          ];

          await quotesService.updateQuoteRequest(
            'draft-001',
            { items },
            mockEvent,
          );

          expect(mockGraphqlQuery).toHaveBeenCalledWith(
            expect.objectContaining({
              queryAsString: 'query:quotes/get-quotation.graphql',
              variables: { quotationId: 'draft-001', languageId: 'sv-SE' },
              userToken: 'test-user-token',
            }),
          );
          expect(
            mockGraphqlMutation.mock.calls[0]![0].variables.request,
          ).toEqual({ items });
        });

        it('is sent at a new amount: the draft holds its configuration', async () => {
          draftWithConfiguredLine();
          mockGraphqlMutation.mockResolvedValueOnce({
            updateQuotationRequest: draftCart('REQUEST_DRAFT'),
          });
          const items = [
            {
              id: 'item-002',
              skuId: 900,
              quantity: 5,
              configurationId: 'cfg-1',
            },
          ];

          await quotesService.updateQuoteRequest(
            'draft-001',
            { items },
            mockEvent,
          );

          expect(
            mockGraphqlMutation.mock.calls[0]![0].variables.request,
          ).toEqual({ items });
        });

        it('refuses a configuration the draft does not hold and writes nothing', async () => {
          draftWithConfiguredLine();
          const line = {
            skuId: 900,
            quantity: 2,
            configurationId: 'cfg-other',
          };

          await expect(
            quotesService.updateQuoteRequest(
              'draft-001',
              { items: [line] },
              mockEvent,
            ),
          ).rejects.toMatchObject({
            code: 'BAD_REQUEST',
            message: 'Configured line cfg-other is not on quote draft-001',
          });
          expect(mockGraphqlMutation).not.toHaveBeenCalled();
        });

        it('refuses the same configuration twice', async () => {
          draftWithConfiguredLine();
          const line = { skuId: 900, quantity: 2, configurationId: 'cfg-1' };

          await expect(
            quotesService.updateQuoteRequest(
              'draft-001',
              { items: [line, line] },
              mockEvent,
            ),
          ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
          expect(mockGraphqlMutation).not.toHaveBeenCalled();
        });
      });
    });

    describe('a configured draft line, replayed and replaced', () => {
      /** Committed sections as Geins sends them: values as text, the deepest list absent. */
      const SECTIONS = [
        {
          id: 's1',
          name: 'Mått',
          variables: [
            { id: 'width', name: 'Width', valueType: 'NUMBER', value: '500' },
            { id: null, name: 'Unnamed', valueType: 'NUMBER', value: '1' },
          ],
          optionGroups: [
            {
              id: 'g1',
              name: 'Adapter',
              options: [
                { id: 'adapter', instanceId: '0', name: 'S50', quantity: 1 },
                { id: null, instanceId: '0', name: 'Gone', quantity: 1 },
              ],
              optionGroups: [
                {
                  id: 'g2',
                  name: 'Steel',
                  options: [
                    {
                      id: 'steel',
                      instanceId: null,
                      name: 'Hard',
                      quantity: 2,
                    },
                  ],
                },
              ],
            },
          ],
          sections: [
            {
              id: 's2',
              name: 'Inner',
              variables: [
                {
                  id: 'depth',
                  name: 'Depth',
                  valueType: 'NUMBER',
                  value: '400',
                },
              ],
              optionGroups: [],
            },
          ],
        },
      ];

      /** A draft with a plain line and a configured line of 2, as Geins holds it. */
      function draftCartWithLines(status = 'REQUEST_DRAFT') {
        const cart: Record<string, unknown> = draftCart(status);
        const [plain] = cart.items as Record<string, unknown>[];
        cart.items = [
          { ...plain, message: 'kept' },
          {
            ...plain,
            id: 'item-002',
            skuId: 900,
            quantity: 2,
            message: 'line note',
            configurationId: 'cfg-1',
            configuration: { summary: [], sections: SECTIONS },
            product: {
              productId: 1358,
              name: 'Digging bucket',
              articleNumber: 'DB-001',
            },
          },
        ];
        return cart;
      }

      function draftHolds(cart = draftCartWithLines()) {
        mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });
      }

      describe('getQuoteLineChoices', () => {
        it("answers the line's product, amount and committed choices, values typed", async () => {
          draftHolds();

          await expect(
            quotesService.getQuoteLineChoices(
              'draft-001',
              'item-002',
              mockEvent,
            ),
          ).resolves.toEqual({
            productId: 1358,
            quantity: 2,
            choices: {
              variables: [
                { id: 'width', value: 500 },
                { id: 'depth', value: 400 },
              ],
              options: [
                { id: 'adapter', instanceId: '0', quantity: 1 },
                { id: 'steel', instanceId: '', quantity: 2 },
              ],
            },
          });
          expect(mockGraphqlQuery).toHaveBeenCalledWith(
            expect.objectContaining({
              queryAsString: 'query:quotes/get-quotation.graphql',
              variables: { quotationId: 'draft-001', languageId: 'sv-SE' },
              userToken: 'test-user-token',
            }),
          );
        });

        it('reads a configured line in first place, and one without a product names none', async () => {
          const cart = draftCartWithLines();
          const items = cart.items as Record<string, unknown>[];
          const { product: _product, ...withoutProduct } = items[1]!;
          cart.items = [withoutProduct, items[0]];
          draftHolds(cart);

          await expect(
            quotesService.getQuoteLineChoices(
              'draft-001',
              'item-002',
              mockEvent,
            ),
          ).resolves.toMatchObject({ productId: null, quantity: 2 });
        });

        it.each([
          [
            'a line committed before its structure was recorded',
            (() => {
              const cart = draftCartWithLines();
              const items = cart.items as Record<string, unknown>[];
              items[1]!.configuration = { summary: [], sections: null };
              return cart;
            })(),
          ],
          [
            'a configured line without its configuration',
            (() => {
              const cart = draftCartWithLines();
              const items = cart.items as Record<string, unknown>[];
              items[1]!.configuration = null;
              return cart;
            })(),
          ],
        ])('answers the amount with no choices for %s', async (_case, cart) => {
          draftHolds(cart);

          await expect(
            quotesService.getQuoteLineChoices(
              'draft-001',
              'item-002',
              mockEvent,
            ),
          ).resolves.toEqual({ productId: 1358, quantity: 2, choices: null });
        });

        it.each([
          ['a plain line', 'item-001', draftCartWithLines()],
          ['a line that is gone', 'item-009', draftCartWithLines()],
          [
            'a quotation that is no longer a draft',
            'item-002',
            draftCartWithLines('REQUESTED'),
          ],
          [
            'a cart without lines',
            'item-002',
            (() => {
              const cart = draftCartWithLines();
              delete cart.items;
              return cart;
            })(),
          ],
          [
            'a cart without its quotation',
            'item-002',
            (() => {
              const cart = draftCartWithLines();
              delete cart.quotation;
              return cart;
            })(),
          ],
          ['a draft that is not found', 'item-002', null],
        ])('says the line is gone for %s', async (_case, lineId, cart) => {
          mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

          await expect(
            quotesService.getQuoteLineChoices('draft-001', lineId, mockEvent),
          ).rejects.toMatchObject({
            code: 'QUOTE_LINE_GONE',
            message: `Line ${lineId} is not a configured line of draft draft-001`,
          });
        });

        it('passes on a read that failed', async () => {
          const down = new Error('Geins down');
          mockGraphqlQuery.mockRejectedValueOnce(down);

          await expect(
            quotesService.getQuoteLineChoices(
              'draft-001',
              'item-002',
              mockEvent,
            ),
          ).rejects.toBe(down);
        });
      });

      describe('replaceConfiguredLine', () => {
        const COMMITTED = { committedConfigurationId: 'cfg-new', quantity: 3 };

        /** The product the page saving the line shows: the line's. */
        const PRODUCT = '1358';

        it("commits, then sends the whole list with the new configuration in the line's place", async () => {
          draftHolds();
          draftHolds();
          mockGraphqlMutation.mockResolvedValueOnce({
            updateQuotationRequest: draftCart('REQUEST_DRAFT'),
          });
          const commit = vi.fn(async () => COMMITTED);

          const quote = await quotesService.replaceConfiguredLine(
            'draft-001',
            'item-002',
            PRODUCT,
            commit,
            mockEvent,
          );

          expect(commit).toHaveBeenCalledOnce();
          expect(mockGraphqlMutation).toHaveBeenCalledWith(
            expect.objectContaining({
              queryAsString: 'query:quotes/update-quotation-request.graphql',
              userToken: 'test-user-token',
              requestOptions: { context: { timeoutMs: 0 } },
              variables: {
                quotationId: 'draft-001',
                languageId: 'sv-SE',
                request: {
                  items: [
                    {
                      id: 'item-001',
                      skuId: 501,
                      quantity: 2,
                      message: 'kept',
                    },
                    {
                      skuId: 900,
                      quantity: 3,
                      configurationId: 'cfg-new',
                      message: 'line note',
                    },
                  ],
                },
              },
            }),
          );
          expect(quote.id).toBe('draft-001');
        });

        it('sends another configured line back by its own configuration', async () => {
          const cart = draftCartWithLines();
          const items = cart.items as Record<string, unknown>[];
          cart.items = [
            {
              ...items[1],
              id: 'item-003',
              configurationId: 'cfg-2',
              message: null,
            },
            ...items,
          ];
          draftHolds(cart);
          draftHolds(cart);
          mockGraphqlMutation.mockResolvedValueOnce({
            updateQuotationRequest: draftCart('REQUEST_DRAFT'),
          });

          await quotesService.replaceConfiguredLine(
            'draft-001',
            'item-002',
            PRODUCT,
            async () => COMMITTED,
            mockEvent,
          );

          const sent =
            mockGraphqlMutation.mock.calls[0]![0].variables.request.items;
          expect(sent[0]).toEqual({
            id: 'item-003',
            skuId: 900,
            quantity: 2,
            configurationId: 'cfg-2',
          });
          expect(sent).toHaveLength(3);
        });

        it.each([
          ['a plain line', 'item-001', draftCartWithLines()],
          ['a line that is gone', 'item-009', draftCartWithLines()],
          [
            'a quotation that is no longer a draft',
            'item-002',
            draftCartWithLines('REQUESTED'),
          ],
          ['a draft that is not found', 'item-002', null],
        ])(
          'refuses %s, committing and writing nothing',
          async (_case, lineId, cart) => {
            mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });
            const commit = vi.fn(async () => COMMITTED);

            await expect(
              quotesService.replaceConfiguredLine(
                'draft-001',
                lineId,
                PRODUCT,
                commit,
                mockEvent,
              ),
            ).rejects.toMatchObject({
              code: 'QUOTE_LINE_GONE',
              message: `Line ${lineId} is not a configured line of draft draft-001`,
            });
            expect(commit).not.toHaveBeenCalled();
            expect(mockGraphqlMutation).not.toHaveBeenCalled();
          },
        );

        it('builds the write from the draft as it is after the commit, keeping a change made meanwhile', async () => {
          draftHolds();
          const changed = draftCartWithLines();
          const items = changed.items as Record<string, unknown>[];
          // Another tab raised the plain line and moved it behind the configured one.
          changed.items = [items[1], { ...items[0], quantity: 9 }];
          draftHolds(changed);
          mockGraphqlMutation.mockResolvedValueOnce({
            updateQuotationRequest: draftCart('REQUEST_DRAFT'),
          });

          await quotesService.replaceConfiguredLine(
            'draft-001',
            'item-002',
            PRODUCT,
            async () => COMMITTED,
            mockEvent,
          );

          expect(mockGraphqlQuery).toHaveBeenCalledTimes(2);
          expect(
            mockGraphqlMutation.mock.calls[0]![0].variables.request.items,
          ).toEqual([
            {
              skuId: 900,
              quantity: 3,
              configurationId: 'cfg-new',
              message: 'line note',
            },
            { id: 'item-001', skuId: 501, quantity: 9, message: 'kept' },
          ]);
        });

        it.each([
          [
            'the line was removed',
            (() => {
              const cart = draftCartWithLines();
              cart.items = [(cart.items as unknown[])[0]];
              return cart;
            })(),
          ],
          ['the draft was sent', draftCartWithLines('REQUESTED')],
        ])(
          'refuses the write when %s during the commit',
          async (_case, after) => {
            draftHolds();
            draftHolds(after);
            const commit = vi.fn(async () => COMMITTED);

            await expect(
              quotesService.replaceConfiguredLine(
                'draft-001',
                'item-002',
                PRODUCT,
                commit,
                mockEvent,
              ),
            ).rejects.toMatchObject({
              code: 'QUOTE_LINE_GONE',
              message:
                'Line item-002 is not a configured line of draft draft-001',
            });
            expect(commit).toHaveBeenCalledOnce();
            expect(mockGraphqlMutation).not.toHaveBeenCalled();
          },
        );

        it.each([
          ['another product', '7'],
          ['no product', ''],
        ])(
          'refuses a save from the page of %s, committing and writing nothing',
          async (_case, productId) => {
            draftHolds();
            const commit = vi.fn(async () => COMMITTED);

            await expect(
              quotesService.replaceConfiguredLine(
                'draft-001',
                'item-002',
                productId,
                commit,
                mockEvent,
              ),
            ).rejects.toMatchObject({
              code: 'QUOTE_LINE_GONE',
              message: `Line item-002 of draft draft-001 is not a line of product ${productId}`,
            });
            expect(commit).not.toHaveBeenCalled();
            expect(mockGraphqlMutation).not.toHaveBeenCalled();
          },
        );

        it('refuses a line that names no product, whatever the page shows', async () => {
          const cart = draftCartWithLines();
          const items = cart.items as Record<string, unknown>[];
          delete items[1]!.product;
          draftHolds(cart);
          const commit = vi.fn(async () => COMMITTED);

          await expect(
            quotesService.replaceConfiguredLine(
              'draft-001',
              'item-002',
              'undefined',
              commit,
              mockEvent,
            ),
          ).rejects.toMatchObject({ code: 'QUOTE_LINE_GONE' });
          expect(commit).not.toHaveBeenCalled();
        });

        it('goes by the product id alone: a line saves whatever its article number is', async () => {
          const cart = draftCartWithLines();
          const items = cart.items as Record<string, unknown>[];
          items[1]!.product = {
            productId: 1358,
            name: 'Digging bucket',
            articleNumber: 'ANOTHER-NUMBER',
          };
          draftHolds(cart);
          draftHolds(cart);
          mockGraphqlMutation.mockResolvedValueOnce({
            updateQuotationRequest: draftCart('REQUEST_DRAFT'),
          });
          const commit = vi.fn(async () => COMMITTED);

          await quotesService.replaceConfiguredLine(
            'draft-001',
            'item-002',
            PRODUCT,
            commit,
            mockEvent,
          );

          expect(commit).toHaveBeenCalledOnce();
          expect(mockGraphqlMutation).toHaveBeenCalledOnce();
        });

        it('refuses another product even when its article number is the same', async () => {
          const cart = draftCartWithLines();
          const items = cart.items as Record<string, unknown>[];
          items[1]!.product = {
            productId: 9999,
            name: 'Another bucket',
            articleNumber: 'DB-001',
          };
          draftHolds(cart);
          const commit = vi.fn(async () => COMMITTED);

          await expect(
            quotesService.replaceConfiguredLine(
              'draft-001',
              'item-002',
              PRODUCT,
              commit,
              mockEvent,
            ),
          ).rejects.toMatchObject({ code: 'QUOTE_LINE_GONE' });
          expect(commit).not.toHaveBeenCalled();
        });

        it('writes nothing when the commit fails', async () => {
          draftHolds();
          const refused = new Error('commit refused');

          await expect(
            quotesService.replaceConfiguredLine(
              'draft-001',
              'item-002',
              PRODUCT,
              async () => {
                throw refused;
              },
              mockEvent,
            ),
          ).rejects.toBe(refused);
          expect(mockGraphqlMutation).not.toHaveBeenCalled();
        });
      });
    });

    describe('deleteQuoteRequest', () => {
      it("deletes the draft in the buyer's channel", async () => {
        mockGraphqlMutation.mockResolvedValueOnce({
          deleteQuotationRequest: true,
        });

        await quotesService.deleteQuoteRequest('draft-001', mockEvent);

        expect(mockGraphqlMutation).toHaveBeenCalledWith(
          expect.objectContaining({
            queryAsString: 'query:quotes/delete-quotation-request.graphql',
            userToken: 'test-user-token',
            variables: {
              quotationId: 'draft-001',
              channelId: '1|se',
              languageId: 'sv-SE',
              marketId: 'se',
            },
            requestOptions: { context: { timeoutMs: 0 } },
          }),
        );
      });

      it.each([false, null])(
        'fails as an external API error when Geins answers %s',
        async (answer) => {
          mockGraphqlMutation.mockResolvedValueOnce({
            deleteQuotationRequest: answer,
          });

          await expect(
            quotesService.deleteQuoteRequest('draft-001', mockEvent),
          ).rejects.toMatchObject({
            code: 'EXTERNAL_API_ERROR',
            message: 'Geins answered false or nothing deleting quote draft-001',
          });
        },
      );

      it('names the quotes service for the error mapping', async () => {
        mockGraphqlMutation.mockResolvedValueOnce({
          deleteQuotationRequest: true,
        });

        await quotesService.deleteQuoteRequest('draft-001', mockEvent);

        expect(vi.mocked(wrapServiceCall)).toHaveBeenLastCalledWith(
          expect.any(Function),
          'quotes',
        );
      });
    });

    describe('releaseQuoteRequest', () => {
      it('sends the draft and returns it requested', async () => {
        mockGraphqlMutation.mockResolvedValueOnce({
          releaseQuotationRequest: draftCart('REQUESTED'),
        });

        const result = await quotesService.releaseQuoteRequest(
          'draft-001',
          mockEvent,
        );

        expect(mockGraphqlMutation).toHaveBeenCalledWith(
          expect.objectContaining({
            queryAsString: 'query:quotes/release-quotation-request.graphql',
            userToken: 'test-user-token',
            variables: { quotationId: 'draft-001', languageId: 'sv-SE' },
          }),
        );
        expect(result).toMatchObject({ id: 'draft-001', status: 'requested' });
      });
    });

    describe.each([
      {
        name: 'createQuoteRequest',
        field: 'createQuotationRequest',
        run: () =>
          quotesService.createQuoteRequest('cart-abc', 'Varukorg', mockEvent),
      },
      {
        name: 'updateQuoteRequest',
        field: 'updateQuotationRequest',
        run: () =>
          quotesService.updateQuoteRequest(
            'draft-001',
            { comment: 'x' },
            mockEvent,
          ),
      },
      {
        name: 'releaseQuoteRequest',
        field: 'releaseQuotationRequest',
        run: () => quotesService.releaseQuoteRequest('draft-001', mockEvent),
      },
    ])('$name', ({ field, run }) => {
      it('asks for no timeout: a write may finish upstream after a cut', async () => {
        mockGraphqlMutation.mockResolvedValueOnce({
          [field]: draftCart('REQUEST_DRAFT'),
        });

        await run();

        expect(mockGraphqlMutation.mock.calls[0]![0]).toMatchObject({
          requestOptions: { context: { timeoutMs: 0 } },
        });
      });

      // Geins answers a refusal ("Cart not found.") as an error with null data.
      it('fails as an external API error when Geins answers no quotation', async () => {
        mockGraphqlMutation.mockResolvedValueOnce({ [field]: null });

        await expect(run()).rejects.toMatchObject({
          code: 'EXTERNAL_API_ERROR',
          message: expect.stringMatching(/quotation-request\.graphql$/),
        });
      });

      it('names the quotes service for the error mapping', async () => {
        mockGraphqlMutation.mockResolvedValueOnce({
          [field]: draftCart('REQUEST_DRAFT'),
        });

        await run();

        expect(wrapServiceCall).toHaveBeenCalledWith(
          expect.any(Function),
          'quotes',
        );
      });

      it('sends no user token when the request carries no context', async () => {
        const { buildRequestContext } =
          await import('../../../server/services/_sdk');
        vi.mocked(buildRequestContext).mockReturnValueOnce(undefined);
        mockGraphqlMutation.mockResolvedValueOnce({
          [field]: draftCart('REQUEST_DRAFT'),
        });

        await run();

        expect(mockGraphqlMutation.mock.calls[0]![0].userToken).toBeUndefined();
      });

      it('passes a Geins error on', async () => {
        const geinsError = new Error('Geins refused');
        mockGraphqlMutation.mockRejectedValueOnce(geinsError);

        await expect(run()).rejects.toBe(geinsError);
      });
    });
  });
});
