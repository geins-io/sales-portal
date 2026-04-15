import type { Quote, QuoteListItem } from '#shared/types/quote';

// ---------------------------------------------------------------------------
// Shared quote test fixtures.
//
// Single source of truth for test factories across:
//   - tests/stores/quotes.test.ts
//   - tests/components/pages/PortalQuotationDetail.test.ts
//   - tests/components/pages/PortalQuotations.test.ts
//   - tests/server/services/quotes.test.ts (raw GraphQL shape only)
//
// Defaults mirror the richest in-tree fixture (the detail-page test). Each
// factory accepts `Partial<>` overrides so individual tests can tune only the
// fields they care about. Never change defaults to mask a failing test —
// always override at the callsite.
// ---------------------------------------------------------------------------

/**
 * Domain `Quote` factory. Defaults match the detail-page test's richest shape
 * (line items with `imageFileName`, `paymentTerms`, `expiresAt`). Any field
 * can be overridden, including setting optional fields back to `undefined`.
 */
export function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'q-001',
    quoteNumber: 'QUO-2026-001',
    createdBy: 'user@example.com',
    contactName: 'Jane Doe',
    contactEmail: 'jane@example.com',
    status: 'pending',
    lineItems: [
      {
        productId: 1,
        sku: 'SKU-A',
        name: 'Widget Pro',
        articleNumber: 'ART-001',
        quantity: 2,
        unitPrice: 100,
        unitPriceFormatted: '100,00 kr',
        totalPrice: 200,
        totalPriceFormatted: '200,00 kr',
        imageFileName: '/img/widget.jpg',
      },
    ],
    subtotal: 200,
    subtotalFormatted: '200,00 kr',
    tax: 50,
    taxFormatted: '50,00 kr',
    shipping: 0,
    shippingFormatted: '',
    total: 250,
    totalFormatted: '250,00 kr',
    currency: 'SEK',
    paymentTerms: 'Net 30',
    expiresAt: '2026-04-01T00:00:00Z',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * `QuoteListItem` factory for the list-page and store tests. Defaults match
 * the list-page test's fixture (en-gb-formatted total, 3 item count).
 */
export function makeQuoteListItem(
  overrides: Partial<QuoteListItem> = {},
): QuoteListItem {
  return {
    id: 'q-001',
    quoteNumber: 'Q-2024-001',
    contactName: 'Jane Doe',
    contactEmail: 'jane@example.com',
    status: 'pending',
    total: 1500,
    totalFormatted: '1 500,00 kr',
    currency: 'SEK',
    itemCount: 3,
    createdAt: '2024-03-01T10:00:00Z',
    ...overrides,
  };
}

/**
 * Raw GraphQL `CartType` response shape for server-service mapper tests.
 *
 * Intentionally loose-typed (`Record<string, unknown>`) because the mapping
 * tests exercise the raw → domain transform and rely on the shape's
 * flexibility (e.g. deleting `summary.shipping` to simulate missing fields).
 *
 * Overrides are spread into the `quotation` sub-object — this matches the
 * original in-file factory's behavior where callers typically tweak
 * `status`, `shippingAddress`, `name`, etc. all living under `quotation`.
 */
export function makeRawQuotationCart(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
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
