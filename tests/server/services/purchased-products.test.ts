import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock the user service (external boundary)
const mockGetUserOrders = vi.fn();
vi.mock('../../../server/services/user', () => ({
  getUserOrders: (...args: unknown[]) => mockGetUserOrders(...args),
}));

// Mock auto-imported wrapServiceCall (used transitively)
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
  createdAt?: string;
  billingAddress?: {
    firstName?: string;
    lastName?: string;
  } | null;
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
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    status: 'Placed',
    billingAddress:
      overrides.billingAddress === null
        ? null
        : {
            firstName: overrides.billingAddress?.firstName ?? 'John',
            lastName: overrides.billingAddress?.lastName ?? 'Doe',
            company: '',
            mobile: '',
            phone: '',
            careOf: '',
            entryCode: '',
            addressLine1: '',
            addressLine2: '',
            addressLine3: '',
            zip: '',
            city: '',
            state: '',
            country: '',
          },
    cart:
      overrides.items === null
        ? null
        : {
            items: (overrides.items ?? []).map((item) => ({
              quantity: item.quantity ?? 1,
              skuId: 100,
              unitPrice: {
                isDiscounted: false,
                sellingPriceIncVat: 0,
                sellingPriceExVat: item.sellingPriceExVat ?? 100,
                regularPriceIncVat: 0,
                regularPriceExVat: 0,
                vat: 0,
                discountPercentage: 0,
                sellingPriceExVatFormatted:
                  item.sellingPriceExVatFormatted ?? '100 kr',
              },
              product: {
                productId: 1,
                articleNumber: item.articleNumber ?? 'ART-001',
                name: item.name ?? 'Test Product',
                alias: 'test-product',
              },
              totalPrice: null,
            })),
            summary: null,
          },
  };
}

describe('getPurchasedProducts', () => {
  const mockEvent = {} as H3Event;

  beforeEach(async () => {
    vi.clearAllMocks();
    purchasedProducts =
      await import('../../../server/services/purchased-products');
  });

  it('aggregates products from multiple orders correctly', async () => {
    mockGetUserOrders.mockResolvedValueOnce({
      getOrders: [
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
      ],
    });

    const result = await purchasedProducts.getPurchasedProducts(
      'test-token',
      mockEvent,
    );

    expect(result.total).toBe(2);
    expect(result.products).toHaveLength(2);
    expect(result.products[0]!.articleNumber).toBe('ART-002');
    expect(result.products[1]!.articleNumber).toBe('ART-001');
  });

  it('deduplicates same articleNumber across orders and sums quantity', async () => {
    mockGetUserOrders.mockResolvedValueOnce({
      getOrders: [
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
      ],
    });

    const result = await purchasedProducts.getPurchasedProducts(
      'test-token',
      mockEvent,
    );

    expect(result.total).toBe(1);
    expect(result.products[0]).toEqual(
      expect.objectContaining({
        articleNumber: 'ART-001',
        totalQuantity: 8,
        priceExVat: 60,
        latestOrderId: '2',
        latestOrderDate: '2026-03-15T00:00:00Z',
      }),
    );
  });

  it('uses latest order date/id/buyer when same product appears in multiple orders', async () => {
    mockGetUserOrders.mockResolvedValueOnce({
      getOrders: [
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
      ],
    });

    const result = await purchasedProducts.getPurchasedProducts(
      'test-token',
      mockEvent,
    );

    expect(result.products[0]).toEqual(
      expect.objectContaining({
        latestOrderId: '10',
        latestOrderDate: '2026-04-01T00:00:00Z',
        latestBuyerName: 'Alice Smith',
        priceExVat: 99,
        totalQuantity: 3,
      }),
    );
  });

  it('returns empty array when no orders', async () => {
    mockGetUserOrders.mockResolvedValueOnce(undefined);

    const result = await purchasedProducts.getPurchasedProducts(
      'test-token',
      mockEvent,
    );

    expect(result).toEqual({ products: [], total: 0 });
  });

  it('returns empty array when orders have no cart items', async () => {
    mockGetUserOrders.mockResolvedValueOnce({
      getOrders: [makeOrder({ items: null }), makeOrder({ items: [] })],
    });

    const result = await purchasedProducts.getPurchasedProducts(
      'test-token',
      mockEvent,
    );

    expect(result).toEqual({ products: [], total: 0 });
  });

  it('handles null billingAddress gracefully', async () => {
    mockGetUserOrders.mockResolvedValueOnce({
      getOrders: [
        makeOrder({
          billingAddress: null,
          items: [{ articleNumber: 'ART-001', name: 'Widget', quantity: 1 }],
        }),
      ],
    });

    const result = await purchasedProducts.getPurchasedProducts(
      'test-token',
      mockEvent,
    );

    expect(result.products[0]!.latestBuyerName).toBe('');
  });

  it('handles null unitPrice gracefully', async () => {
    mockGetUserOrders.mockResolvedValueOnce({
      getOrders: [
        {
          id: 1,
          createdAt: '2026-01-01T00:00:00Z',
          status: 'Placed',
          billingAddress: {
            firstName: 'John',
            lastName: 'Doe',
            company: '',
            mobile: '',
            phone: '',
            careOf: '',
            entryCode: '',
            addressLine1: '',
            addressLine2: '',
            addressLine3: '',
            zip: '',
            city: '',
            state: '',
            country: '',
          },
          cart: {
            items: [
              {
                quantity: 2,
                skuId: 100,
                unitPrice: null,
                product: {
                  productId: 1,
                  articleNumber: 'ART-001',
                  name: 'Widget',
                  alias: 'widget',
                },
                totalPrice: null,
              },
            ],
            summary: null,
          },
        },
      ],
    });

    const result = await purchasedProducts.getPurchasedProducts(
      'test-token',
      mockEvent,
    );

    expect(result.products[0]!.priceExVat).toBe(0);
    expect(result.products[0]!.priceExVatFormatted).toBeUndefined();
  });

  it('sorts results by latest order date descending', async () => {
    mockGetUserOrders.mockResolvedValueOnce({
      getOrders: [
        makeOrder({
          id: 1,
          createdAt: '2026-01-01T00:00:00Z',
          items: [
            { articleNumber: 'ART-OLD', name: 'Old Product', quantity: 1 },
          ],
        }),
        makeOrder({
          id: 2,
          createdAt: '2026-06-01T00:00:00Z',
          items: [
            { articleNumber: 'ART-NEW', name: 'New Product', quantity: 1 },
          ],
        }),
        makeOrder({
          id: 3,
          createdAt: '2026-03-01T00:00:00Z',
          items: [
            { articleNumber: 'ART-MID', name: 'Mid Product', quantity: 1 },
          ],
        }),
      ],
    });

    const result = await purchasedProducts.getPurchasedProducts(
      'test-token',
      mockEvent,
    );

    expect(result.products.map((p) => p.articleNumber)).toEqual([
      'ART-NEW',
      'ART-MID',
      'ART-OLD',
    ]);
  });
});
