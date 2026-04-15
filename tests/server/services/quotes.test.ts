import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

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
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A raw CartType response from the Geins GraphQL API */
function makeRawQuotationCart(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cart-001',
    items: [
      {
        id: 'item-001',
        skuId: 501,
        quantity: 2,
        unitPrice: {
          sellingPriceIncVat: 4995,
          sellingPriceIncVatFormatted: '4 995 SEK',
        },
        totalPrice: {
          sellingPriceIncVat: 9990,
          sellingPriceIncVatFormatted: '9 990 SEK',
        },
        product: {
          productId: 101,
          name: 'Standing Desk Oak Large',
          articleNumber: 'SD-OAK-L',
          productImages: [{ fileName: '/img/desk.jpg' }],
        },
      },
    ],
    summary: {
      subTotal: {
        sellingPriceIncVat: 9990,
        sellingPriceIncVatFormatted: '9 990 SEK',
        sellingPriceExVat: 7992,
        sellingPriceExVatFormatted: '7 992 SEK',
        vat: 1998,
        vatFormatted: '1 998 SEK',
      },
      shipping: {
        feeIncVat: 49,
        feeIncVatFormatted: '49 SEK',
      },
      total: {
        sellingPriceIncVat: 10039,
        sellingPriceIncVatFormatted: '10 039 SEK',
      },
    },
    quotation: {
      quotationNumber: 'Q-20260101001',
      name: 'Office order',
      currency: 'SEK',
      marketId: 'se',
      channelId: '1|se',
      status: 'PENDING',
      createdAt: '2026-03-01T10:15:00Z',
      modifiedAt: '2026-03-01T10:15:00Z',
      validFrom: '2026-03-01T00:00:00Z',
      validTo: '2026-04-01T00:00:00Z',
      company: { companyId: 'comp-1', name: 'Acme Corp', vatNumber: 'SE12345' },
      owner: {
        ownerId: 'owner-1',
        firstName: 'Lisa',
        lastName: 'Andersson',
        phone: '+46123456',
      },
      customer: {
        customerId: 'cust-1',
        internalCustomerId: 'ic-1',
        firstName: 'Lisa',
        lastName: 'Andersson',
        phone: '+46123456',
        approvedAt: null,
        rejectedAt: null,
      },
      terms: { text: 'Net 30' },
      billingAddress: {
        email: 'lisa@acmecorp.se',
        phone: '+46123456',
        company: 'Acme Corp',
        firstName: 'Lisa',
        lastName: 'Andersson',
        addressLine1: 'Street 1',
        addressLine2: null,
        addressLine3: null,
        zip: '11122',
        city: 'Stockholm',
        region: null,
        country: 'SE',
      },
      shippingAddress: {
        email: 'delivery@acmecorp.se',
        phone: '+46987654',
        company: 'Acme Corp Warehouse',
        firstName: 'Warehouse',
        lastName: 'Receiver',
        addressLine1: 'Industrivagen 5',
        addressLine2: 'Building B',
        addressLine3: null,
        zip: '55533',
        city: 'Goteborg',
        region: null,
        country: 'SE',
      },
      orderId: null,
      ...overrides,
    },
  };
}

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
          variables: expect.objectContaining({
            channelId: '1|se',
            languageId: 'sv-SE',
            marketId: 'se',
          }),
        }),
      );

      expect(result.quotes).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.quotes[0]).toMatchObject({
        id: 'cart-001',
        quoteNumber: 'Q-20260101001',
        status: 'pending',
        totalFormatted: '10 039 SEK',
        currency: 'SEK',
        itemCount: 1,
      });
    });

    it('returns empty array when listQuotationCarts returns null', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ listQuotationCarts: null });

      const result = await quotesService.listQuotes('org-1', 0, 10, mockEvent);

      expect(result.quotes).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('maps QuotationStatus enum values to lowercase QuoteStatus', async () => {
      const statuses = [
        'DRAFT',
        'PENDING',
        'EXPIRED',
        'REJECTED',
        'ACCEPTED',
        'CONFIRMED',
        'FINALIZED',
        'CANCELED',
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
        'pending',
        'pending',
        'expired',
        'rejected',
        'accepted',
        'accepted',
        'accepted',
        'cancelled',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // getQuote
  // -------------------------------------------------------------------------
  describe('getQuote', () => {
    it('calls graphql.query with getQuotationCart and maps to Quote type', async () => {
      const cart = makeRawQuotationCart();
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });

      const result = await quotesService.getQuote('cart-001', mockEvent);

      expect(mockGraphqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: 'query:quotes/get-quotation.graphql',
          variables: expect.objectContaining({
            quotationId: 'cart-001',
            channelId: '1|se',
            languageId: 'sv-SE',
            marketId: 'se',
          }),
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
        tax: 1998,
        taxFormatted: '1 998 SEK',
        shipping: 49,
        shippingFormatted: '49 SEK',
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
        imageFileName: '/img/desk.jpg',
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
  // acceptQuote
  // -------------------------------------------------------------------------
  describe('acceptQuote', () => {
    it('calls graphql.mutation with acceptQuotation mutation', async () => {
      const cart = makeRawQuotationCart({ status: 'ACCEPTED' });
      mockGraphqlMutation.mockResolvedValueOnce({ acceptQuotation: cart });

      const result = await quotesService.acceptQuote('cart-001', mockEvent);

      expect(mockGraphqlMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: 'query:quotes/accept-quotation.graphql',
          variables: expect.objectContaining({
            quotationId: 'cart-001',
            channelId: '1|se',
          }),
        }),
      );

      expect(result.status).toBe('accepted');
    });
  });

  // -------------------------------------------------------------------------
  // rejectQuote
  // -------------------------------------------------------------------------
  describe('rejectQuote', () => {
    it('calls graphql.mutation with rejectQuotation mutation', async () => {
      const cart = makeRawQuotationCart({ status: 'REJECTED' });
      mockGraphqlMutation.mockResolvedValueOnce({ rejectQuotation: cart });

      const result = await quotesService.rejectQuote('cart-001', mockEvent);

      expect(mockGraphqlMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: 'query:quotes/reject-quotation.graphql',
          variables: expect.objectContaining({
            quotationId: 'cart-001',
            channelId: '1|se',
          }),
        }),
      );

      expect(result.status).toBe('rejected');
    });
  });
});
