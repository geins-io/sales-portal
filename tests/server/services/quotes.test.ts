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
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
});

let quotesService: typeof import('../../../server/services/quotes');

describe('quotes service', () => {
  const mockEvent = {
    context: {
      tenant: {
        config: { geinsSettings: { availableLocales: ['sv-SE'] } },
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
        totalFormatted: '10 039 SEK',
        totalExVat: 8031.2,
        totalExVatFormatted: '8 031 SEK',
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
        totalFormatted: '10 039 SEK',
        subtotal: 9990,
        subtotalFormatted: '9 990 SEK',
        tax: 2007.8,
        taxFormatted: '2 007,80 SEK',
        shipping: 49,
        shippingFormatted: '49 SEK',
        subtotalExVat: 7992,
        subtotalExVatFormatted: '7 992 SEK',
        shippingExVat: 39.2,
        shippingExVatFormatted: '39 SEK',
        totalExVat: 8031.2,
        totalExVatFormatted: '8 031 SEK',
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
        sku: '501',
        name: 'Standing Desk Oak Large',
        articleNumber: 'SD-OAK-L',
        quantity: 2,
        unitPrice: 4995,
        unitPriceFormatted: '4 995 SEK',
        totalPrice: 9990,
        totalPriceFormatted: '9 990 SEK',
        unitPriceExVat: 3996,
        unitPriceExVatFormatted: '3 996 SEK',
        totalPriceExVat: 7992,
        totalPriceExVatFormatted: '7 992 SEK',
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

    it('returns undefined for shippingAddress when raw shippingAddress is null', async () => {
      const cart = makeRawQuotationCart({ shippingAddress: null });
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(result.shippingAddress).toBeUndefined();
      // Billing still populated even when shipping is missing
      expect(result.billingAddress).toBeDefined();
      expect(result.billingAddress?.addressLine1).toBe('Street 1');
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
      expect(result.taxFormatted).toBe('2 007,80 SEK');
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

    it('throws when quotation cart is not found', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: null });

      await expect(
        quotesService.getQuote('nonexistent', mockEvent),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // acceptQuote / rejectQuote
  // -------------------------------------------------------------------------
  // Geins answers both mutations with a Boolean; the quotation is read again
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
});
