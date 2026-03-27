import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let categories, products, cms services run for real
// ---------------------------------------------------------------------------
const mockGraphqlQuery = vi.fn();

const mockSDK = {
  core: {
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' },
    graphql: { query: mockGraphqlQuery, mutation: vi.fn() },
  },
  cms: {
    page: { get: vi.fn() },
  },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
  buildRequestContext: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
}));

vi.mock('../../../server/services/graphql/unwrap', () => ({
  unwrapGraphQL: vi.fn((result: unknown) => {
    if (result === null || result === undefined) return result;
    if (typeof result !== 'object' || Array.isArray(result)) return result;
    const keys = Object.keys(result as Record<string, unknown>);
    if (keys.length === 1) {
      return (result as Record<string, unknown>)[keys[0]!];
    }
    return result;
  }),
}));

// Stub Nitro auto-imports
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));
vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue(undefined));

function mockEvent(hostname = 'test.com') {
  return {
    context: { tenant: { hostname } },
  } as unknown as import('h3').H3Event;
}

/**
 * Helper to configure SDK mock responses based on query path.
 * Routes.ts calls getCategories, getProduct, getPage through the SDK.
 * Each uses a different GraphQL query file.
 */
function setupGraphqlMocks(opts: {
  categories?: Array<{ alias: string; categoryId: number }>;
  product?: { alias: string; productId: number; canonicalUrl?: string } | null;
  page?: { id: string; containers: unknown[] } | null;
}) {
  mockGraphqlQuery.mockImplementation(
    (args: { queryAsString: string; variables?: Record<string, unknown> }) => {
      if (args.queryAsString.includes('categories/categories')) {
        return Promise.resolve({
          categories: opts.categories ?? [],
        });
      }
      if (args.queryAsString.includes('brands/brands')) {
        return Promise.resolve({ brands: [] });
      }
      if (args.queryAsString.includes('products/product')) {
        if (opts.product) {
          return Promise.resolve({ product: opts.product });
        }
        return Promise.reject(new Error('not found'));
      }
      // Default: reject for unknowns
      return Promise.reject(new Error('not found'));
    },
  );

  // CMS page uses sdk.cms.page.get, not graphql
  if (opts.page) {
    mockSDK.cms.page.get.mockResolvedValue(opts.page);
  } else {
    mockSDK.cms.page.get.mockRejectedValue(new Error('not found'));
  }
}

describe('resolveRoute service', () => {
  let resolveRoute: typeof import('../../../server/services/routes').resolveRoute;
  let clearCategoryCache: typeof import('../../../server/services/routes').clearCategoryCache;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('../../../server/services/routes');
    resolveRoute = mod.resolveRoute;
    clearCategoryCache = mod.clearCategoryCache;

    clearCategoryCache();
    setupGraphqlMocks({});
  });

  it('returns not-found for empty segments', async () => {
    const result = await resolveRoute([], mockEvent());
    expect(result).toEqual({ type: 'not-found' });
  });

  it('resolves single segment matching category', async () => {
    setupGraphqlMocks({ categories: [{ alias: 'shoes', categoryId: 42 }] });

    const result = await resolveRoute(['shoes'], mockEvent());
    expect(result).toEqual({
      type: 'category',
      categoryId: '42',
      categorySlug: 'shoes',
    });
  });

  it('resolves category + subcategory to subcategory', async () => {
    setupGraphqlMocks({
      categories: [
        { alias: 'shoes', categoryId: 42 },
        { alias: 'sneakers', categoryId: 99 },
      ],
    });

    const result = await resolveRoute(['shoes', 'sneakers'], mockEvent());
    expect(result).toEqual({
      type: 'category',
      categoryId: '99',
      categorySlug: 'sneakers',
    });
  });

  it('resolves category + product slug to product', async () => {
    setupGraphqlMocks({
      categories: [{ alias: 'shoes', categoryId: 42 }],
      product: {
        alias: 'red-sneaker',
        productId: 101,
        canonicalUrl: '/shoes/red-sneaker',
      },
    });

    const result = await resolveRoute(['shoes', 'red-sneaker'], mockEvent());
    expect(result).toEqual({
      type: 'product',
      productId: '101',
      productSlug: 'red-sneaker',
      categorySlug: 'shoes',
      canonical: '/shoes/red-sneaker',
    });
  });

  it('resolves single segment as product when no category match', async () => {
    setupGraphqlMocks({
      product: {
        alias: 'cool-jacket',
        productId: 200,
        canonicalUrl: '/cool-jacket',
      },
    });

    const result = await resolveRoute(['cool-jacket'], mockEvent());
    expect(result).toEqual({
      type: 'product',
      productId: '200',
      productSlug: 'cool-jacket',
      canonical: '/cool-jacket',
    });
  });

  it('resolves single segment as CMS page when no category or product match', async () => {
    setupGraphqlMocks({
      page: { id: 'page-55', containers: [{ widgets: [] }] },
    });

    const result = await resolveRoute(['about-us'], mockEvent());
    expect(result).toEqual({
      type: 'page',
      pageId: 'page-55',
      pageSlug: 'about-us',
    });
  });

  it('returns not-found when nothing matches', async () => {
    const result = await resolveRoute(['nonexistent'], mockEvent());
    expect(result).toEqual({ type: 'not-found' });
  });

  it('uses cached category map on second call', async () => {
    setupGraphqlMocks({ categories: [{ alias: 'shoes', categoryId: 42 }] });

    await resolveRoute(['shoes'], mockEvent());
    await resolveRoute(['shoes'], mockEvent());

    // getCategories calls graphql.query — should only call once for categories
    const categoryCalls = mockGraphqlQuery.mock.calls.filter(
      (args: unknown[]) =>
        (args[0] as { queryAsString: string }).queryAsString.includes(
          'categories/categories',
        ),
    );
    expect(categoryCalls).toHaveLength(1);
  });

  it('returns empty map on category fetch failure, falls through to product/page', async () => {
    mockGraphqlQuery.mockImplementation((args: { queryAsString: string }) => {
      if (args.queryAsString.includes('categories/categories')) {
        return Promise.reject(new Error('API error'));
      }
      if (args.queryAsString.includes('brands/brands')) {
        return Promise.reject(new Error('API error'));
      }
      if (args.queryAsString.includes('products/product')) {
        return Promise.resolve({
          product: { alias: 'shoes', productId: 300 },
        });
      }
      return Promise.reject(new Error('not found'));
    });
    mockSDK.cms.page.get.mockRejectedValue(new Error('not found'));

    const result = await resolveRoute(['shoes'], mockEvent());
    expect(result).toEqual({
      type: 'product',
      productId: '300',
      productSlug: 'shoes',
    });
  });

  it('resolves 3-segment path as category/subcategory/product', async () => {
    setupGraphqlMocks({
      categories: [
        { alias: 'clothing', categoryId: 10 },
        { alias: 'shoes', categoryId: 20 },
      ],
      product: {
        alias: 'red-sneaker',
        productId: 101,
        canonicalUrl: '/clothing/shoes/red-sneaker',
      },
    });

    const result = await resolveRoute(
      ['clothing', 'shoes', 'red-sneaker'],
      mockEvent(),
    );
    expect(result).toEqual({
      type: 'product',
      productId: '101',
      productSlug: 'red-sneaker',
      categorySlug: 'shoes',
      canonical: '/clothing/shoes/red-sneaker',
    });
  });

  it('isolates category cache per tenant hostname', async () => {
    // First call for tenant-a
    mockGraphqlQuery.mockImplementation((args: { queryAsString: string }) => {
      if (args.queryAsString.includes('categories/categories')) {
        return Promise.resolve({
          categories: [{ alias: 'shoes', categoryId: 42 }],
        });
      }
      if (args.queryAsString.includes('brands/brands')) {
        return Promise.resolve({ brands: [] });
      }
      return Promise.reject(new Error('not found'));
    });

    const result1 = await resolveRoute(['shoes'], mockEvent('tenant-a.com'));

    // Change mock for tenant-b
    mockGraphqlQuery.mockImplementation((args: { queryAsString: string }) => {
      if (args.queryAsString.includes('categories/categories')) {
        return Promise.resolve({
          categories: [{ alias: 'shoes', categoryId: 99 }],
        });
      }
      if (args.queryAsString.includes('brands/brands')) {
        return Promise.resolve({ brands: [] });
      }
      return Promise.reject(new Error('not found'));
    });

    const result2 = await resolveRoute(['shoes'], mockEvent('tenant-b.com'));

    expect(result1).toEqual({
      type: 'category',
      categoryId: '42',
      categorySlug: 'shoes',
    });
    expect(result2).toEqual({
      type: 'category',
      categoryId: '99',
      categorySlug: 'shoes',
    });
  });
});
