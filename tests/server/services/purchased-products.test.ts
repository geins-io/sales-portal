import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

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

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi
    .fn()
    .mockReturnValue('query getCompanyOrdersForPurchasedProducts'),
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
    productImages?: Array<{ fileName?: string | null; url?: string | null }>;
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
                productImages: item.productImages,
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

  it('flags a product the configurator stands behind, and only that one', async () => {
    withOrders([
      makeOrder({
        items: [
          { articleNumber: 'KONF-1001', productId: Number(CONFIGURABLE_ID) },
          { articleNumber: 'ART-001', productId: 42 },
        ],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);
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

    await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(mockIsConfigurable).toHaveBeenCalledWith({
      productId: '1359',
      type: 'configurable',
    });
  });

  it('never exposes the product id or type in the response', async () => {
    withOrders([makeOrder({ items: [{ articleNumber: 'ART-001' }] })]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]).not.toHaveProperty('productId');
    expect(result.products[0]).not.toHaveProperty('type');
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

  it('keeps the library url with the file name of the same image', async () => {
    withOrders([
      makeOrder({
        items: [
          {
            productImages: [
              {
                fileName: 'widget.jpg',
                url: 'https://cdn.example.test/acme/products/widget.jpg',
              },
            ],
          },
        ],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]).toMatchObject({
      imageFileName: 'widget.jpg',
      imageUrl: 'https://cdn.example.test/acme/products/widget.jpg',
    });
  });

  it('gives a product without images neither a file name nor a url', async () => {
    withOrders([makeOrder({ items: [{}] })]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]).toMatchObject({
      imageFileName: null,
      imageUrl: null,
    });
  });

  it('takes the image from a later order only as a pair, when the first had none', async () => {
    withOrders([
      makeOrder({
        id: 1,
        createdAt: '2026-03-15T00:00:00Z',
        items: [{ productImages: [] }],
      }),
      makeOrder({
        id: 2,
        createdAt: '2026-01-15T00:00:00Z',
        items: [
          {
            productImages: [
              {
                fileName: 'widget.jpg',
                url: 'https://cdn.example.test/acme/products/widget.jpg',
              },
            ],
          },
        ],
      }),
      makeOrder({
        id: 3,
        createdAt: '2026-02-15T00:00:00Z',
        items: [
          {
            productImages: [
              {
                fileName: 'other.jpg',
                url: 'https://cdn.example.test/acme/products/other.jpg',
              },
            ],
          },
        ],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]).toMatchObject({
      imageFileName: 'widget.jpg',
      imageUrl: 'https://cdn.example.test/acme/products/widget.jpg',
    });
  });

  it('keeps a legacy image without a library url', async () => {
    withOrders([
      makeOrder({
        items: [{ productImages: [{ fileName: 'old.jpg', url: null }] }],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result.products[0]).toMatchObject({
      imageFileName: 'old.jpg',
      imageUrl: null,
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

      const result = await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(result.products[0]!.skuId).toBe(301);
    });

    it('takes the latest order’s sku when it comes after an older one', async () => {
      withOrders([older(301), newer(302)]);

      const result = await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(result.products).toHaveLength(1);
      expect(result.products[0]!.skuId).toBe(302);
    });

    it('keeps the latest order’s sku when an older one comes after it', async () => {
      withOrders([newer(302), older(301)]);

      const result = await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(result.products[0]!.skuId).toBe(302);
    });

    it('gives a line without a sku no sku at all', async () => {
      withOrders([
        makeOrder({ items: [{ articleNumber: 'ART-001', skuId: null }] }),
      ]);

      const result = await purchasedProducts.getPurchasedProducts(mockEvent);

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

      const result = await purchasedProducts.getPurchasedProducts(mockEvent);

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

      const result = await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(result.products[0]!.skuId).toBe(301);
    });
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
          id: 'kristian@acme.se',
          firstName: 'Kristian',
          lastName: 'Arvidsson',
        },
        { id: 'tina@acme.se', firstName: 'Tina', lastName: 'Ekestangs' },
      ],
    });
    withOrders([
      makeOrder({
        id: 1,
        customerEmail: 'KRISTIAN@acme.se',
        billingAddress: { firstName: 'Acme', lastName: 'Billing' },
        items: [{ articleNumber: 'ART-001', name: 'Widget', quantity: 1 }],
      }),
    ]);

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    // The orderer (matched case-insensitively by email), not the billing contact.
    expect(result.products[0]!.latestBuyerName).toBe('Kristian Arvidsson');
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

  it('returns empty array when GraphQL returns null', async () => {
    mockGraphqlQuery.mockResolvedValueOnce({ getCompanyOrders: null });

    const result = await purchasedProducts.getPurchasedProducts(mockEvent);

    expect(result).toEqual({ products: [], total: 0 });
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
          skuId: 9001,
        }),
      ]);
      expect(products[0]).not.toHaveProperty('productId');
    });

    it('keeps what the order line carries for a product the catalogue no longer has', async () => {
      withOrders([
        makeOrder({
          items: [
            {
              ...swedishLine(),
              alias: 'kopparror-18-mm-5-m-en-1057',
              productImages: [{ fileName: 'old.jpg', url: 'https://cdn/old' }],
            },
          ],
        }),
      ]);

      const { products } =
        await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(products[0]).toMatchObject({
        name: 'Kopparrör 18 mm 5 m EN 1057',
        alias: 'kopparror-18-mm-5-m-en-1057',
        imageFileName: 'old.jpg',
        imageUrl: 'https://cdn/old',
      });
    });

    it("keeps the order line's image when the catalogue product has none", async () => {
      withOrders([
        makeOrder({
          items: [
            {
              ...swedishLine(),
              productImages: [{ fileName: 'old.jpg', url: 'https://cdn/old' }],
            },
          ],
        }),
      ]);
      mockGetCatalogueProducts.mockResolvedValue(
        new Map([[1031, { ...COPPER, productImages: [] }]]),
      );

      const { products } =
        await purchasedProducts.getPurchasedProducts(mockEvent);

      expect(products[0]).toMatchObject({
        name: 'Copper pipe 18 mm 5 m EN 1057',
        imageFileName: 'old.jpg',
        imageUrl: 'https://cdn/old',
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

    it('keeps what the order line carries where the catalogue product has no name, alias or image', async () => {
      withOrders([
        makeOrder({
          items: [
            {
              ...swedishLine(),
              alias: 'kopparror',
              productImages: [{ fileName: 'old.jpg', url: 'https://cdn/old' }],
            },
          ],
        }),
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
        imageFileName: 'old.jpg',
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
