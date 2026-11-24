import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import { OrderError } from '@geins/core';

const mockGraphqlQuery = vi.fn();

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    core: { graphql: { query: mockGraphqlQuery } },
  }),
  buildRequestContext: vi
    .fn()
    .mockReturnValue({ userToken: 'test-user-token' }),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
}));

// Echoes the document name, so a test can tell which read was sent.
vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((file: string) => `query from ${file}`),
}));

// getCompany supplies the buyers list used to resolve the orderer's name from
// customerEmail. Mocked here so the test controls it independently of the
// orders query.
const mockGetCompany = vi.fn();
vi.mock('../../../server/services/company', () => ({
  getCompany: (...args: unknown[]) => mockGetCompany(...args),
}));

// The configurator seam. What the answer depends on belongs to the seam's own
// tests; this fake says yes for one product id.
const CONFIGURABLE_ID = '1101';
const mockIsConfigurable = vi.fn(
  (product: { productId: string; type?: string | null }) =>
    product.productId === CONFIGURABLE_ID,
);
const mockConfigurableCheck = vi.fn((_event: unknown) => mockIsConfigurable);
vi.mock('../../../server/services/configurator', () => ({
  configurableCheck: (event: unknown) => mockConfigurableCheck(event),
}));

// The catalogue in the request language. Empty by default, so a test that
// does not set it reads what the order lines carry.
const mockGetCatalogueProducts = vi.fn();
vi.mock('../../../server/services/products', () => ({
  getCatalogueProducts: (...args: unknown[]) =>
    mockGetCatalogueProducts(...args),
}));

vi.stubGlobal(
  'wrapServiceCall',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
});

let purchasedProducts: typeof import('../../../server/services/purchased-products');

function makeOrder(overrides: {
  id?: number;
  publicId?: string | null;
  createdAt?: string;
  customerEmail?: string | null;
  billingAddress?: { firstName?: string; lastName?: string } | null;
  items?: Array<{
    skuId?: number | null;
    productId?: number | null;
    type?: string;
    articleNumber?: string;
    name?: string;
    alias?: string | null;
    quantity?: number;
    sellingPriceExVat?: number;
    sellingPriceExVatFormatted?: string;
    sellingPriceIncVat?: number;
    sellingPriceIncVatFormatted?: string;
  }> | null;
}) {
  return {
    id: overrides.id ?? 1,
    publicId:
      overrides.publicId === undefined
        ? `pub-${overrides.id ?? 1}`
        : overrides.publicId,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    customerEmail:
      overrides.customerEmail === undefined ? null : overrides.customerEmail,
    billingAddress:
      overrides.billingAddress === null
        ? null
        : {
            firstName: overrides.billingAddress?.firstName ?? 'John',
            lastName: overrides.billingAddress?.lastName ?? 'Doe',
          },
    cart:
      overrides.items === null
        ? null
        : {
            items: (overrides.items ?? []).map((item) => ({
              skuId: item.skuId === undefined ? 9001 : item.skuId,
              quantity: item.quantity ?? 1,
              unitPrice: {
                sellingPriceExVat: item.sellingPriceExVat ?? 100,
                sellingPriceExVatFormatted:
                  item.sellingPriceExVatFormatted ?? '100 kr',
                sellingPriceIncVat: item.sellingPriceIncVat ?? 125,
                sellingPriceIncVatFormatted:
                  item.sellingPriceIncVatFormatted ?? '125 kr',
              },
              product: {
                productId: item.productId === undefined ? 1 : item.productId,
                type: item.type ?? 'product',
                articleNumber: item.articleNumber ?? 'ART-001',
                name: item.name ?? 'Test Product',
                alias: item.alias,
              },
            })),
          },
  };
}

// The service unwraps a `{ getCompanyOrders: [...] }` GraphQL shape into the
// array. Tests mock `sdk.core.graphql.query` to return that wrapper.
function withOrders(orders: ReturnType<typeof makeOrder>[]) {
  mockGraphqlQuery.mockResolvedValueOnce({ getCompanyOrders: orders });
}

describe('getPurchasedProducts', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: no company buyers, so latestBuyerName falls back to the order
    // email or billing name. Tests that exercise the name mapping override this.
    mockGetCompany.mockResolvedValue(null);
    mockGetCatalogueProducts.mockResolvedValue(new Map());
    purchasedProducts =
      await import('../../../server/services/purchased-products');
  });

  it('aggregates products from multiple orders correctly', async () => {
    withOrders([
      makeOrder({
        id: 1,
        createdAt: '2026-01-15T00:00:00Z',
        items: [
          {
            articleNumber: 'ART-001',
            name: 'Widget',
            quantity: 2,
            sellingPriceExVat: 50,
          },
        ],
      }),
      makeOrder({
        id: 2,
        createdAt: '2026-02-15T00:00:00Z',
        items: [
          {
            articleNumber: 'ART-002',
            name: 'Gadget',
            quantity: 1,
            sellingPriceExVat: 75,
          },
        ],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.total).toBe(2);
    expect(result.products).toHaveLength(2);
    expect(result.products[0]!.articleNumber).toBe('ART-002');
    expect(result.products[1]!.articleNumber).toBe('ART-001');
  });

  it('reads its own document', async () => {
    withOrders([]);

    await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(mockGraphqlQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryAsString: 'query from orders/purchased-products.graphql',
      }),
    );
  });

  it('carries neither the product id, type, sku nor a configurable flag', async () => {
    withOrders([
      makeOrder({
        items: [
          { articleNumber: 'KONF-1001', productId: Number(CONFIGURABLE_ID) },
        ],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    for (const key of ['productId', 'type', 'skuId', 'configurable']) {
      expect(result.products[0]).not.toHaveProperty(key);
    }
    expect(mockConfigurableCheck).not.toHaveBeenCalled();
  });

  it('passes userToken from requestContext to the GraphQL call', async () => {
    withOrders([]);

    await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(mockGraphqlQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        userToken: 'test-user-token',
        variables: expect.objectContaining({
          channelId: '1',
          languageId: 'sv-SE',
          marketId: 'se',
        }),
      }),
    );
  });

  it('deduplicates same articleNumber across orders and sums quantity', async () => {
    withOrders([
      makeOrder({
        id: 1,
        createdAt: '2026-01-15T00:00:00Z',
        items: [
          {
            articleNumber: 'ART-001',
            name: 'Widget',
            quantity: 3,
            sellingPriceExVat: 50,
            sellingPriceExVatFormatted: '50 kr',
            sellingPriceIncVat: 62.5,
            sellingPriceIncVatFormatted: '62,50 kr',
          },
        ],
      }),
      makeOrder({
        id: 2,
        createdAt: '2026-03-15T00:00:00Z',
        items: [
          {
            articleNumber: 'ART-001',
            name: 'Widget',
            quantity: 5,
            sellingPriceExVat: 60,
            sellingPriceExVatFormatted: '60 kr',
            sellingPriceIncVat: 75,
            sellingPriceIncVatFormatted: '75 kr',
          },
        ],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.total).toBe(1);
    expect(result.products[0]).toEqual(
      expect.objectContaining({
        articleNumber: 'ART-001',
        totalQuantity: 8,
        priceExVat: 60,
        priceExVatFormatted: '60 kr',
        priceIncVat: 75,
        priceIncVatFormatted: '75 kr',
        latestOrderId: '2',
        latestOrderPublicId: 'pub-2',
        latestOrderDate: '2026-03-15T00:00:00Z',
      }),
    );
  });

  describe('the image', () => {
    const withCatalogueImages = (
      productImages: Array<{ fileName?: string | null; url?: string | null }>,
    ) =>
      mockGetCatalogueProducts.mockResolvedValue(
        new Map([[1, { productId: 1, productImages }]]),
      );

    it('keeps the library url with the file name of the same image', async () => {
      withOrders([makeOrder({ items: [{}] })]);
      withCatalogueImages([
        {
          fileName: 'widget.jpg',
          url: 'https://cdn.example.test/acme/products/widget.jpg',
        },
        { fileName: 'second.jpg', url: 'https://cdn.example.test/second.jpg' },
      ]);

      const result = await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(result.products[0]).toMatchObject({
        imageFileName: 'widget.jpg',
        imageUrl: 'https://cdn.example.test/acme/products/widget.jpg',
      });
    });

    it('gives a product without images neither a file name nor a url', async () => {
      withOrders([makeOrder({ items: [{}] })]);
      withCatalogueImages([]);

      const result = await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(result.products[0]).toMatchObject({
        imageFileName: null,
        imageUrl: null,
      });
    });

    it('keeps a legacy image without a library url', async () => {
      withOrders([makeOrder({ items: [{}] })]);
      withCatalogueImages([{ fileName: 'old.jpg', url: null }]);

      const result = await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(result.products[0]).toMatchObject({
        imageFileName: 'old.jpg',
        imageUrl: null,
      });
    });
  });

  it('uses latest order date/id/buyer when same product appears in multiple orders', async () => {
    withOrders([
      makeOrder({
        id: 10,
        createdAt: '2026-04-01T00:00:00Z',
        billingAddress: { firstName: 'Alice', lastName: 'Smith' },
        items: [
          {
            articleNumber: 'ART-001',
            name: 'Widget',
            quantity: 1,
            sellingPriceExVat: 99,
          },
        ],
      }),
      makeOrder({
        id: 5,
        createdAt: '2026-01-01T00:00:00Z',
        billingAddress: { firstName: 'Bob', lastName: 'Jones' },
        items: [
          {
            articleNumber: 'ART-001',
            name: 'Widget',
            quantity: 2,
            sellingPriceExVat: 80,
          },
        ],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]).toEqual(
      expect.objectContaining({
        latestOrderId: '10',
        latestOrderPublicId: 'pub-10',
        latestOrderDate: '2026-04-01T00:00:00Z',
        latestBuyerName: 'Alice Smith',
        priceExVat: 99,
        totalQuantity: 3,
      }),
    );
  });

  it('keeps both VAT sides of the latest order when an older one comes later', async () => {
    withOrders([
      makeOrder({
        id: 10,
        createdAt: '2026-04-01T00:00:00Z',
        items: [
          {
            articleNumber: 'ART-001',
            sellingPriceExVat: 99,
            sellingPriceExVatFormatted: '99 kr',
            sellingPriceIncVat: 123.75,
            sellingPriceIncVatFormatted: '123,75 kr',
          },
        ],
      }),
      makeOrder({
        id: 5,
        createdAt: '2026-01-01T00:00:00Z',
        items: [
          {
            articleNumber: 'ART-001',
            sellingPriceExVat: 80,
            sellingPriceExVatFormatted: '80 kr',
            sellingPriceIncVat: 100,
            sellingPriceIncVatFormatted: '100 kr',
          },
        ],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]).toEqual(
      expect.objectContaining({
        priceExVat: 99,
        priceExVatFormatted: '99 kr',
        priceIncVat: 123.75,
        priceIncVatFormatted: '123,75 kr',
      }),
    );
  });

  it('resolves latestBuyerName from the order email via the company buyers list', async () => {
    mockGetCompany.mockResolvedValue({
      buyers: [
        {
          id: 'buyer-one@example.com',
          firstName: 'Buyer',
          lastName: 'One',
        },
        { id: 'buyer-two@example.com', firstName: 'Buyer', lastName: 'Two' },
      ],
    });
    withOrders([
      makeOrder({
        id: 1,
        customerEmail: 'BUYER-ONE@example.com',
        billingAddress: { firstName: 'Acme', lastName: 'Billing' },
        items: [{ articleNumber: 'ART-001', name: 'Widget', quantity: 1 }],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    // The orderer (matched case-insensitively by email), not the billing contact.
    expect(result.products[0]!.latestBuyerName).toBe('Buyer One');
  });

  it('matches a buyer whose id has spaces around it, and skips buyers without an id or a name', async () => {
    mockGetCompany.mockResolvedValue({
      buyers: [
        { firstName: 'No', lastName: 'Id' },
        { id: 'nameless@acme.se', firstName: '', lastName: null },
        { id: ' buyer-two@example.com ', firstName: 'Buyer', lastName: 'Two' },
      ],
    });
    withOrders([
      makeOrder({
        id: 1,
        customerEmail: 'buyer-two@example.com',
        items: [{ articleNumber: 'ART-001' }],
      }),
      makeOrder({
        id: 2,
        createdAt: '2026-02-01T00:00:00Z',
        customerEmail: 'nameless@acme.se',
        items: [{ articleNumber: 'ART-002' }],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);
    const byArticle = new Map(result.products.map((p) => [p.articleNumber, p]));

    expect(byArticle.get('ART-001')?.latestBuyerName).toBe('Buyer Two');
    expect(byArticle.get('ART-002')?.latestBuyerName).toBe('nameless@acme.se');
  });

  it('falls back to the order email when no company buyer matches', async () => {
    mockGetCompany.mockResolvedValue({ buyers: [] });
    withOrders([
      makeOrder({
        id: 1,
        customerEmail: 'former@acme.se',
        billingAddress: { firstName: 'Acme', lastName: 'Billing' },
        items: [{ articleNumber: 'ART-001', name: 'Widget', quantity: 1 }],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]!.latestBuyerName).toBe('former@acme.se');
  });

  it('falls back to the billing name when the order has no customerEmail', async () => {
    withOrders([
      makeOrder({
        id: 1,
        customerEmail: null,
        billingAddress: { firstName: 'Acme', lastName: 'Billing' },
        items: [{ articleNumber: 'ART-001', name: 'Widget', quantity: 1 }],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]!.latestBuyerName).toBe('Acme Billing');
  });

  it('returns empty array, without reading the company, when GraphQL returns null', async () => {
    mockGraphqlQuery.mockResolvedValueOnce({ getCompanyOrders: null });

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result).toEqual({ products: [], total: 0 });
    expect(mockGetCompany).not.toHaveBeenCalled();
  });

  it('maps a failed read to an order error', async () => {
    withOrders([]);

    await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(wrapServiceCall).toHaveBeenCalledWith(
      expect.any(Function),
      'order',
      OrderError,
    );
  });

  it('skips a line without a product or an article number', async () => {
    mockGraphqlQuery.mockResolvedValueOnce({
      getCompanyOrders: [
        {
          id: 1,
          createdAt: '2026-01-01T00:00:00Z',
          cart: {
            items: [
              { quantity: 1, product: null },
              { quantity: 1, product: { productId: 5, articleNumber: '' } },
              { quantity: 2, product: { productId: 6, articleNumber: 'A-6' } },
            ],
          },
        },
      ],
    });

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products.map((p) => p.articleNumber)).toEqual(['A-6']);
    expect(mockGetCatalogueProducts).toHaveBeenCalledWith(
      [6],
      mockEvent,
      'test-user-token',
    );
  });

  it('answers empty strings for an order and a product that carry no id, date or name', async () => {
    mockGraphqlQuery.mockResolvedValueOnce({
      getCompanyOrders: [
        {
          id: null,
          publicId: null,
          createdAt: null,
          cart: {
            items: [{ quantity: 1, product: { articleNumber: 'A-1' } }],
          },
        },
      ],
    });

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]).toMatchObject({
      name: '',
      latestOrderId: '',
      latestOrderDate: '',
      latestOrderPublicId: null,
    });
  });

  it('returns empty array when orders have no cart items', async () => {
    withOrders([makeOrder({ items: null }), makeOrder({ items: [] })]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result).toEqual({ products: [], total: 0 });
  });

  it('handles null billingAddress gracefully', async () => {
    withOrders([
      makeOrder({
        billingAddress: null,
        items: [{ articleNumber: 'ART-001', name: 'Widget', quantity: 1 }],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]!.latestBuyerName).toBe('');
  });

  it('handles null unitPrice gracefully', async () => {
    mockGraphqlQuery.mockResolvedValueOnce({
      getCompanyOrders: [
        {
          id: 1,
          createdAt: '2026-01-01T00:00:00Z',
          billingAddress: { firstName: 'John', lastName: 'Doe' },
          cart: {
            items: [
              {
                quantity: 2,
                unitPrice: null,
                product: { articleNumber: 'ART-001', name: 'Widget' },
              },
            ],
          },
        },
      ],
    });

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]!.priceExVat).toBeUndefined();
    expect(result.products[0]!.priceExVatFormatted).toBeUndefined();
    expect(result.products[0]!.priceIncVat).toBeUndefined();
    expect(result.products[0]!.priceIncVatFormatted).toBeUndefined();
  });

  it('sorts results by latest order date descending', async () => {
    withOrders([
      makeOrder({
        id: 1,
        createdAt: '2026-01-01T00:00:00Z',
        items: [{ articleNumber: 'ART-OLD', name: 'Old Product', quantity: 1 }],
      }),
      makeOrder({
        id: 2,
        createdAt: '2026-06-01T00:00:00Z',
        items: [{ articleNumber: 'ART-NEW', name: 'New Product', quantity: 1 }],
      }),
      makeOrder({
        id: 3,
        createdAt: '2026-03-01T00:00:00Z',
        items: [{ articleNumber: 'ART-MID', name: 'Mid Product', quantity: 1 }],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products.map((p) => p.articleNumber)).toEqual([
      'ART-NEW',
      'ART-MID',
      'ART-OLD',
    ]);
  });

  // An order line carries its product only in the language the order was
  // placed in: in any other language its alias is "" and its images are null,
  // and its name stays in the order's language. The catalogue has the product
  // in every language.
  describe('in the language of the page', () => {
    const COPPER = {
      productId: 1031,
      name: 'Copper pipe 18 mm 5 m EN 1057',
      alias: 'copper-pipe-18-mm-5-m-en-1057',
      canonicalUrl: '/se/en/p/pipes/copper-pipe-18-mm-5-m-en-1057',
      productImages: [
        { fileName: 'ror-cu-18-5m-card.jpg', url: 'https://cdn/ror.jpg' },
      ],
    };

    function swedishLine() {
      return {
        productId: 1031,
        articleNumber: 'ROR-CU-18-5M',
        name: 'Kopparrör 18 mm 5 m EN 1057',
        alias: '',
        quantity: 2,
        sellingPriceExVat: 380,
      };
    }

    it('takes the name, alias and image from the catalogue, and the rest from the order', async () => {
      withOrders([makeOrder({ id: 7, items: [swedishLine()] })]);
      mockGetCatalogueProducts.mockResolvedValue(new Map([[1031, COPPER]]));

      const { products } =
        await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(products).toEqual([
        expect.objectContaining({
          name: 'Copper pipe 18 mm 5 m EN 1057',
          alias: 'copper-pipe-18-mm-5-m-en-1057',
          imageFileName: 'ror-cu-18-5m-card.jpg',
          imageUrl: 'https://cdn/ror.jpg',
          articleNumber: 'ROR-CU-18-5M',
          totalQuantity: 2,
          priceExVat: 380,
          latestOrderId: '7',
        }),
      ]);
      expect(products[0]).not.toHaveProperty('productId');
    });

    it('keeps the name and alias the order line carries, and no image, for a product the catalogue no longer has', async () => {
      withOrders([
        makeOrder({
          items: [{ ...swedishLine(), alias: 'kopparror-18-mm-5-m-en-1057' }],
        }),
      ]);

      const { products } =
        await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(products[0]).toMatchObject({
        name: 'Kopparrör 18 mm 5 m EN 1057',
        alias: 'kopparror-18-mm-5-m-en-1057',
        imageFileName: null,
        imageUrl: null,
      });
    });

    it('asks the catalogue once for the whole list, each product once, with the buyer token', async () => {
      withOrders([
        makeOrder({
          id: 1,
          items: [
            { ...swedishLine() },
            { productId: 42, articleNumber: 'ART-042' },
          ],
        }),
        makeOrder({ id: 2, items: [{ ...swedishLine() }] }),
      ]);

      await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(mockGetCatalogueProducts).toHaveBeenCalledOnce();
      expect(mockGetCatalogueProducts).toHaveBeenCalledWith(
        [1031, 42],
        mockEvent,
        'test-user-token',
      );
    });

    it('keeps what the order line carries where the catalogue product has no name or alias', async () => {
      withOrders([
        makeOrder({ items: [{ ...swedishLine(), alias: 'kopparror' }] }),
      ]);
      mockGetCatalogueProducts.mockResolvedValue(
        new Map([
          [1031, { productId: 1031, name: '', alias: '', productImages: null }],
        ]),
      );

      const { products } =
        await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(products[0]).toMatchObject({
        name: 'Kopparrör 18 mm 5 m EN 1057',
        alias: 'kopparror',
        imageFileName: null,
      });
    });

    it('keeps the first alias an order line carries when the catalogue lacks the product', async () => {
      withOrders([
        makeOrder({
          id: 3,
          createdAt: '2026-03-01T00:00:00Z',
          items: [{ ...swedishLine(), alias: 'third' }],
        }),
        makeOrder({
          id: 2,
          createdAt: '2026-02-01T00:00:00Z',
          items: [{ ...swedishLine(), alias: 'second' }],
        }),
        makeOrder({
          id: 1,
          createdAt: '2026-01-01T00:00:00Z',
          items: [{ ...swedishLine(), alias: '' }],
        }),
      ]);

      const { products } =
        await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(products[0]?.alias).toBe('third');
    });

    it('fills a missing alias from a later order line', async () => {
      withOrders([
        makeOrder({ id: 1, items: [{ ...swedishLine(), alias: '' }] }),
        makeOrder({ id: 2, items: [{ ...swedishLine(), alias: 'kopparror' }] }),
        makeOrder({ id: 3, items: [{ ...swedishLine(), alias: 'later' }] }),
      ]);

      const { products } =
        await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(products[0]?.alias).toBe('kopparror');
    });

    it('does not ask the catalogue for a line without a product id', async () => {
      withOrders([
        makeOrder({
          items: [
            { ...swedishLine() },
            { productId: null, articleNumber: 'ART-NOID' },
          ],
        }),
      ]);

      await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(mockGetCatalogueProducts).toHaveBeenCalledWith(
        [1031],
        mockEvent,
        'test-user-token',
      );
    });

    it('asks the catalogue without a token when the request has no context', async () => {
      const sdk = await import('../../../server/services/_sdk');
      vi.mocked(sdk.buildRequestContext).mockReturnValueOnce(undefined);
      withOrders([makeOrder({ items: [swedishLine()] })]);

      await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(mockGetCatalogueProducts).toHaveBeenCalledWith(
        [1031],
        mockEvent,
        undefined,
      );
    });

    it('does not ask the catalogue when the company has no orders', async () => {
      withOrders([]);

      await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(mockGetCatalogueProducts).not.toHaveBeenCalled();
    });
  });
});

describe('getPurchasedProductsOverview', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetCatalogueProducts.mockResolvedValue(new Map());
    purchasedProducts =
      await import('../../../server/services/purchased-products');
  });

  // Five products in five orders, newest first: P5 is the newest.
  function fiveProducts() {
    return [5, 4, 3, 2, 1].map((n) =>
      makeOrder({
        id: n,
        createdAt: `2026-0${n}-01T00:00:00Z`,
        items: [
          {
            productId: 100 + n,
            articleNumber: `P${n}`,
            name: `Product ${n}`,
            quantity: n === 1 ? 50 : 1,
          },
        ],
      }),
    );
  }

  it('reads its own document with the buyer token, and not the company', async () => {
    withOrders([]);

    await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(mockGraphqlQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryAsString: 'query from orders/purchased-products-overview.graphql',
        userToken: 'test-user-token',
        variables: expect.objectContaining({ channelId: '1' }),
      }),
    );
    expect(mockGetCompany).not.toHaveBeenCalled();
  });

  it('reads without a token when the request has no context', async () => {
    const sdk = await import('../../../server/services/_sdk');
    vi.mocked(sdk.buildRequestContext).mockReturnValueOnce(undefined);
    withOrders([]);

    await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(mockGraphqlQuery).toHaveBeenCalledWith(
      expect.objectContaining({ userToken: undefined }),
    );
  });

  it('answers the 4 newest products, the count of all and the most-bought name', async () => {
    withOrders(fiveProducts());

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(result.products.map((p) => p.articleNumber)).toEqual([
      'P5',
      'P4',
      'P3',
      'P2',
    ]);
    expect(result.total).toBe(5);
    expect(result.mostPurchasedName).toBe('Product 1');
  });

  it('gives a card only what the card shows', async () => {
    withOrders([
      makeOrder({
        id: 7,
        items: [
          {
            productId: 42,
            articleNumber: 'ART-042',
            name: 'Widget',
            skuId: 301,
            sellingPriceExVat: 80,
            sellingPriceExVatFormatted: '80 kr',
            sellingPriceIncVat: 100,
            sellingPriceIncVatFormatted: '100 kr',
          },
        ],
      }),
    ]);

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(result.products).toEqual([
      {
        name: 'Widget',
        articleNumber: 'ART-042',
        alias: null,
        imageFileName: null,
        imageUrl: null,
        priceExVat: 80,
        priceExVatFormatted: '80 kr',
        priceIncVat: 100,
        priceIncVatFormatted: '100 kr',
        skuId: 301,
      },
    ]);
  });

  it('sums the quantity of a product over every order for the most-bought name', async () => {
    withOrders([
      makeOrder({
        id: 3,
        createdAt: '2026-03-01T00:00:00Z',
        items: [{ productId: 1, articleNumber: 'A', name: 'A', quantity: 3 }],
      }),
      makeOrder({
        id: 2,
        createdAt: '2026-02-01T00:00:00Z',
        items: [{ productId: 2, articleNumber: 'B', name: 'B', quantity: 4 }],
      }),
      makeOrder({
        id: 1,
        createdAt: '2026-01-01T00:00:00Z',
        items: [{ productId: 1, articleNumber: 'A', name: 'A', quantity: 2 }],
      }),
    ]);

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(result.mostPurchasedName).toBe('A');
  });

  it('gives a tie for the most bought to the more recently bought product', async () => {
    withOrders([
      makeOrder({
        id: 1,
        createdAt: '2026-01-01T00:00:00Z',
        items: [
          { productId: 1, articleNumber: 'OLD', name: 'Old', quantity: 2 },
        ],
      }),
      makeOrder({
        id: 2,
        createdAt: '2026-02-01T00:00:00Z',
        items: [
          { productId: 2, articleNumber: 'NEW', name: 'New', quantity: 2 },
        ],
      }),
    ]);

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(result.mostPurchasedName).toBe('New');
  });

  it('asks the catalogue once, for the 4 newest and the most-bought, with the buyer token', async () => {
    withOrders(fiveProducts());

    await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(mockGetCatalogueProducts).toHaveBeenCalledOnce();
    expect(mockGetCatalogueProducts).toHaveBeenCalledWith(
      [105, 104, 103, 102, 101],
      mockEvent,
      'test-user-token',
    );
  });

  it('asks the catalogue for each product once when the most-bought is among the newest', async () => {
    const orders = fiveProducts();
    orders[0]!.cart!.items[0]!.quantity = 99;
    withOrders(orders);

    await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(mockGetCatalogueProducts).toHaveBeenCalledWith(
      [105, 104, 103, 102],
      mockEvent,
      'test-user-token',
    );
  });

  it('asks the catalogue for a product under two article numbers once', async () => {
    withOrders([
      makeOrder({
        items: [
          { productId: 1001, articleNumber: 'SKU-A' },
          { productId: 1001, articleNumber: 'SKU-B' },
        ],
      }),
    ]);

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(result.total).toBe(2);
    expect(mockGetCatalogueProducts).toHaveBeenCalledWith(
      [1001],
      mockEvent,
      'test-user-token',
    );
  });

  it('takes name, alias and image from the catalogue, the most-bought name too', async () => {
    withOrders([
      makeOrder({
        items: [
          {
            productId: 1031,
            articleNumber: 'ROR',
            name: 'Kopparrör',
            quantity: 5,
          },
        ],
      }),
    ]);
    mockGetCatalogueProducts.mockResolvedValue(
      new Map([
        [
          1031,
          {
            productId: 1031,
            name: 'Copper pipe',
            alias: 'copper-pipe',
            productImages: [
              { fileName: 'ror.jpg', url: 'https://cdn/ror.jpg' },
            ],
          },
        ],
      ]),
    );

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(result.products[0]).toMatchObject({
      name: 'Copper pipe',
      alias: 'copper-pipe',
      imageFileName: 'ror.jpg',
      imageUrl: 'https://cdn/ror.jpg',
    });
    expect(result.mostPurchasedName).toBe('Copper pipe');
  });

  it('keeps the order line name, and no alias or image, for a product the catalogue lacks', async () => {
    withOrders([
      makeOrder({
        items: [
          {
            productId: 1031,
            articleNumber: 'ROR',
            name: 'Kopparrör',
          },
        ],
      }),
    ]);

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(result.products[0]).toMatchObject({
      name: 'Kopparrör',
      alias: null,
      imageFileName: null,
      imageUrl: null,
    });
    expect(result.mostPurchasedName).toBe('Kopparrör');
  });

  it('answers no products, no count and no name, and asks no catalogue, without orders', async () => {
    mockGraphqlQuery.mockResolvedValueOnce({ getCompanyOrders: null });

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(result).toEqual({ products: [], total: 0, mostPurchasedName: null });
    expect(mockGetCatalogueProducts).not.toHaveBeenCalled();
  });

  it('never exposes the product id or type', async () => {
    withOrders([makeOrder({ items: [{ articleNumber: 'ART-001' }] })]);

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(result.products[0]).not.toHaveProperty('productId');
    expect(result.products[0]).not.toHaveProperty('type');
  });

  it('flags a product the configurator stands behind, and only that one', async () => {
    withOrders([
      makeOrder({
        items: [
          { articleNumber: 'KONF-1001', productId: Number(CONFIGURABLE_ID) },
          { articleNumber: 'ART-001', productId: 42 },
        ],
      }),
    ]);

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);
    const byArticle = new Map(result.products.map((p) => [p.articleNumber, p]));

    expect(byArticle.get('KONF-1001')?.configurable).toBe(true);
    expect(byArticle.get('ART-001')).not.toHaveProperty('configurable');
    expect(mockConfigurableCheck).toHaveBeenCalledOnce();
    expect(mockConfigurableCheck).toHaveBeenCalledWith(mockEvent);
  });

  it('asks the seam with the product id and type the order line carries', async () => {
    withOrders([
      makeOrder({
        items: [
          { articleNumber: 'M-1359', productId: 1359, type: 'configurable' },
        ],
      }),
    ]);

    await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(mockIsConfigurable).toHaveBeenCalledWith({
      productId: '1359',
      type: 'configurable',
    });
  });

  it('never exposes the product id or type in the response', async () => {
    withOrders([makeOrder({ items: [{ articleNumber: 'ART-001' }] })]);

    const result =
      await purchasedProducts.getPurchasedProductsOverview(mockEvent);

    expect(result.products[0]).not.toHaveProperty('productId');
    expect(result.products[0]).not.toHaveProperty('type');
  });

  // A card cannot pick between SKUs, so it needs the product's own count from
  // the catalogue, not the count of the SKUs bought.
  describe('the SKU count of the product', () => {
    function withCatalogueSkus(skus: Array<{ skuId?: number | null } | null>) {
      mockGetCatalogueProducts.mockResolvedValue(
        new Map([[1, { productId: 1, name: 'Glasses', skus }]]),
      );
    }

    it('carries the catalogue count when only one of its SKUs was bought', async () => {
      withOrders([makeOrder({ items: [{ skuId: 1115 }] })]);
      withCatalogueSkus([
        { skuId: 1099 },
        { skuId: 1113 },
        { skuId: 1114 },
        { skuId: 1115 },
      ]);

      const result =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);

      expect(result.products[0]!.skuCount).toBe(4);
    });

    it('carries a count of one for a product with one SKU', async () => {
      withOrders([makeOrder({ items: [{ skuId: 1029 }] })]);
      withCatalogueSkus([{ skuId: 1029 }]);

      const result =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);

      expect(result.products[0]!.skuCount).toBe(1);
    });

    it('counts only the SKUs that have an id', async () => {
      withOrders([makeOrder({ items: [{ skuId: 1029 }] })]);
      withCatalogueSkus([null, { skuId: 1029 }, { skuId: null }]);

      const result =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);

      expect(result.products[0]!.skuCount).toBe(1);
    });

    it('carries no count for a product the catalogue lacks or sends no SKUs for', async () => {
      withOrders([makeOrder({ items: [{ skuId: 1029 }] })]);

      const missing =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);
      expect(missing.products[0]).not.toHaveProperty('skuCount');

      withOrders([makeOrder({ items: [{ skuId: 1029 }] })]);
      withCatalogueSkus([]);

      const empty =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);
      expect(empty.products[0]).not.toHaveProperty('skuCount');
    });
  });

  describe('the sku a row adds to the cart', () => {
    const older = (skuId: number) =>
      makeOrder({
        id: 5,
        createdAt: '2026-01-01T00:00:00Z',
        items: [{ articleNumber: 'ART-001', skuId }],
      });
    const newer = (skuId: number) =>
      makeOrder({
        id: 10,
        createdAt: '2026-04-01T00:00:00Z',
        items: [{ articleNumber: 'ART-001', skuId }],
      });

    it('carries the order line’s sku', async () => {
      withOrders([newer(301)]);

      const result =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);

      expect(result.products[0]!.skuId).toBe(301);
    });

    it('takes the latest order’s sku when it comes after an older one', async () => {
      withOrders([older(301), newer(302)]);

      const result =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);

      expect(result.products).toHaveLength(1);
      expect(result.products[0]!.skuId).toBe(302);
    });

    it('keeps the latest order’s sku when an older one comes after it', async () => {
      withOrders([newer(302), older(301)]);

      const result =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);

      expect(result.products[0]!.skuId).toBe(302);
    });

    it('gives a line without a sku no sku at all', async () => {
      withOrders([
        makeOrder({ items: [{ articleNumber: 'ART-001', skuId: null }] }),
      ]);

      const result =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);

      expect(result.products[0]).not.toHaveProperty('skuId');
    });

    it('keeps an older sku when the latest line has none', async () => {
      withOrders([
        older(301),
        makeOrder({
          id: 10,
          createdAt: '2026-04-01T00:00:00Z',
          items: [{ articleNumber: 'ART-001', skuId: null }],
        }),
      ]);

      const result =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);

      expect(result.products[0]!.skuId).toBe(301);
    });

    it('keeps the first line’s sku when one order holds two of the product', async () => {
      withOrders([
        makeOrder({
          items: [
            { articleNumber: 'ART-001', skuId: 301 },
            { articleNumber: 'ART-001', skuId: 302 },
          ],
        }),
      ]);

      const result =
        await purchasedProducts.getPurchasedProductsOverview(mockEvent);

      expect(result.products[0]!.skuId).toBe(301);
    });
  });
});

describe('getLatestOrderForProduct', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    purchasedProducts =
      await import('../../../server/services/purchased-products');
  });

  const order = (id: number, createdAt: string, productIds: number[]) =>
    makeOrder({
      id,
      createdAt,
      items: productIds.map((productId, i) => ({
        productId,
        articleNumber: `ART-${productId}-${i}`,
      })),
    });

  it('reads its own document with the buyer token, and neither the company nor the catalogue', async () => {
    withOrders([order(1, '2026-01-01T00:00:00Z', [42])]);

    await purchasedProducts.getLatestOrderForProduct(mockEvent, 42);

    expect(mockGraphqlQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryAsString: 'query from orders/latest-order-for-product.graphql',
        userToken: 'test-user-token',
        variables: expect.objectContaining({ channelId: '1' }),
      }),
    );
    expect(mockGetCompany).not.toHaveBeenCalled();
    expect(mockGetCatalogueProducts).not.toHaveBeenCalled();
  });

  it('answers the id, public id and date of the newest order holding the product', async () => {
    withOrders([
      order(5, '2026-01-01T00:00:00Z', [42]),
      order(10, '2026-04-01T00:00:00Z', [7, 42]),
      order(7, '2026-02-01T00:00:00Z', [42]),
      order(12, '2026-05-01T00:00:00Z', [7]),
    ]);

    expect(
      await purchasedProducts.getLatestOrderForProduct(mockEvent, 42),
    ).toEqual({
      id: '10',
      publicId: 'pub-10',
      createdAt: '2026-04-01T00:00:00Z',
    });
  });

  it('finds the product under any article number it was ordered as', async () => {
    withOrders([
      makeOrder({
        id: 2,
        createdAt: '2026-02-01T00:00:00Z',
        items: [{ productId: 1001, articleNumber: 'SKU-B' }],
      }),
      makeOrder({
        id: 1,
        createdAt: '2026-01-01T00:00:00Z',
        items: [{ productId: 1001, articleNumber: 'SKU-A' }],
      }),
    ]);

    const latest = await purchasedProducts.getLatestOrderForProduct(
      mockEvent,
      1001,
    );

    expect(latest?.id).toBe('2');
  });

  it('keeps the first of two orders placed at the same time', async () => {
    withOrders([
      order(3, '2026-01-01T00:00:00Z', [42]),
      order(4, '2026-01-01T00:00:00Z', [42]),
    ]);

    const latest = await purchasedProducts.getLatestOrderForProduct(
      mockEvent,
      42,
    );

    expect(latest?.id).toBe('3');
  });

  it('answers a missing public id as null', async () => {
    withOrders([
      makeOrder({ id: 3, publicId: null, items: [{ productId: 42 }] }),
    ]);

    const latest = await purchasedProducts.getLatestOrderForProduct(
      mockEvent,
      42,
    );

    expect(latest?.publicId).toBeNull();
  });

  it('reads without a token when the request has no context', async () => {
    const sdk = await import('../../../server/services/_sdk');
    vi.mocked(sdk.buildRequestContext).mockReturnValueOnce(undefined);
    withOrders([]);

    await purchasedProducts.getLatestOrderForProduct(mockEvent, 42);

    expect(mockGraphqlQuery).toHaveBeenCalledWith(
      expect.objectContaining({ userToken: undefined }),
    );
  });

  it('answers empty strings for an order without an id or a date', async () => {
    mockGraphqlQuery.mockResolvedValueOnce({
      getCompanyOrders: [
        {
          id: null,
          publicId: 'p',
          createdAt: null,
          cart: { items: [{ product: { productId: 42 } }] },
        },
      ],
    });

    expect(
      await purchasedProducts.getLatestOrderForProduct(mockEvent, 42),
    ).toEqual({ id: '', publicId: 'p', createdAt: '' });
  });

  it('answers null for a product the company never ordered', async () => {
    mockGraphqlQuery.mockResolvedValueOnce({
      getCompanyOrders: [
        order(1, '2026-01-01T00:00:00Z', [7]),
        { id: 8, cart: { items: null } },
        { id: 9, cart: { items: [{ product: null }] } },
        makeOrder({ items: null }),
      ],
    });

    expect(
      await purchasedProducts.getLatestOrderForProduct(mockEvent, 42),
    ).toBeNull();
  });

  it('answers null when the company has no orders', async () => {
    mockGraphqlQuery.mockResolvedValueOnce({ getCompanyOrders: null });

    expect(
      await purchasedProducts.getLatestOrderForProduct(mockEvent, 42),
    ).toBeNull();
  });
});
