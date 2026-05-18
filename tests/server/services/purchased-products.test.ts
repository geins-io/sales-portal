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
  loadQuery: vi.fn().mockReturnValue('query getOrdersForPurchasedProducts'),
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
  billingAddress?: { firstName?: string; lastName?: string } | null;
  items?: Array<{
    articleNumber?: string;
    name?: string;
    quantity?: number;
    sellingPriceExVat?: number;
    sellingPriceExVatFormatted?: string;
  }> | null;
}) {
  return {
    id: overrides.id ?? 1,
    publicId:
      overrides.publicId === undefined
        ? `pub-${overrides.id ?? 1}`
        : overrides.publicId,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
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
              quantity: item.quantity ?? 1,
              unitPrice: {
                sellingPriceExVat: item.sellingPriceExVat ?? 100,
                sellingPriceExVatFormatted:
                  item.sellingPriceExVatFormatted ?? '100 kr',
              },
              product: {
                articleNumber: item.articleNumber ?? 'ART-001',
                name: item.name ?? 'Test Product',
              },
            })),
          },
  };
}

// The service unwraps a `{ getOrders: [...] }` GraphQL shape into the array.
// Tests mock `sdk.core.graphql.query` to return that wrapper.
function withOrders(orders: ReturnType<typeof makeOrder>[]) {
  mockGraphqlQuery.mockResolvedValueOnce({ getOrders: orders });
}

describe('getPurchasedProducts', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
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
        latestOrderId: '2',
        latestOrderPublicId: 'pub-2',
        latestOrderDate: '2026-03-15T00:00:00Z',
      }),
    );
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

  it('returns empty array when GraphQL returns null', async () => {
    mockGraphqlQuery.mockResolvedValueOnce({ getOrders: null });

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
      getOrders: [
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

    expect(result.products[0]!.priceExVat).toBe(0);
    expect(result.products[0]!.priceExVatFormatted).toBeUndefined();
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
});
