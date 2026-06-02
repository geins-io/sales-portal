import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// Mock the entity-resolver services and the SDK boundary.
// The resolver under test composes getProduct / getCategoryPage / getBrandPage
// and the urlHistory GraphQL query; we mock all three services and the SDK.
// ---------------------------------------------------------------------------
const mockGetProduct = vi.fn();
const mockGetCategoryPage = vi.fn();
const mockGetBrandPage = vi.fn();
const mockGraphqlQuery = vi.fn();

vi.mock('../../../server/services/products', () => ({
  getProduct: (...args: unknown[]) => mockGetProduct(...args),
}));

vi.mock('../../../server/services/product-lists', () => ({
  getCategoryPage: (...args: unknown[]) => mockGetCategoryPage(...args),
  getBrandPage: (...args: unknown[]) => mockGetBrandPage(...args),
}));

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    core: { graphql: { query: mockGraphqlQuery } },
  }),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn().mockReturnValue('query urlHistory'),
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

vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

let resolver: typeof import('../../../server/services/url-resolver');

const createMockEvent = (): H3Event =>
  ({
    context: { tenant: { tenantId: 't1', hostname: 'test.example.com' } },
  }) as unknown as H3Event;

const ARGS = { path: '/se/sv/grenror-150-150-88', alias: 'grenror-150-150-88' };

describe('resolveEntityUrl', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetProduct.mockResolvedValue(null);
    mockGetCategoryPage.mockResolvedValue(null);
    mockGetBrandPage.mockResolvedValue(null);
    mockGraphqlQuery.mockResolvedValue({ urlHistory: null });
    vi.resetModules();
    resolver = await import('../../../server/services/url-resolver');
  });

  it('returns product (priority) when product, category, and brand all resolve', async () => {
    mockGetProduct.mockResolvedValue({ canonicalUrl: '/p/grenror' });
    mockGetCategoryPage.mockResolvedValue({ canonicalUrl: '/c/grenror' });
    mockGetBrandPage.mockResolvedValue({ canonicalUrl: '/b/grenror' });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({ type: 'product', canonicalUrl: '/p/grenror' });
    expect(mockGraphqlQuery).not.toHaveBeenCalled();
  });

  it('returns category when product is null', async () => {
    mockGetCategoryPage.mockResolvedValue({ canonicalUrl: '/c/grenror' });
    mockGetBrandPage.mockResolvedValue({ canonicalUrl: '/b/grenror' });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({ type: 'category', canonicalUrl: '/c/grenror' });
  });

  it('returns brand when product and category are null', async () => {
    mockGetBrandPage.mockResolvedValue({ canonicalUrl: '/b/grenror' });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({ type: 'brand', canonicalUrl: '/b/grenror' });
  });

  it('ignores an entity whose canonicalUrl is empty and continues', async () => {
    mockGetProduct.mockResolvedValue({ canonicalUrl: '' });
    mockGetCategoryPage.mockResolvedValue({ canonicalUrl: '/c/grenror' });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({ type: 'category', canonicalUrl: '/c/grenror' });
  });

  it('tolerates a thrown not-found from one resolver (allSettled)', async () => {
    mockGetProduct.mockRejectedValue(new Error('not found'));
    mockGetCategoryPage.mockResolvedValue({ canonicalUrl: '/c/grenror' });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({ type: 'category', canonicalUrl: '/c/grenror' });
  });

  it('falls back to urlHistory and returns { redirect: newUrl } when alias misses', async () => {
    mockGraphqlQuery.mockResolvedValue({
      urlHistory: { oldUrl: '/se/sv/old-slug', newUrl: '/se/sv/new-slug' },
    });

    const event = createMockEvent();
    const result = await resolver.resolveEntityUrl(ARGS, event);

    expect(result).toEqual({ redirect: '/se/sv/new-slug' });
    // urlHistory is called with the full inbound path, not the alias
    expect(mockGraphqlQuery).toHaveBeenCalledTimes(1);
    const call = mockGraphqlQuery.mock.calls[0]![0] as {
      variables: Record<string, unknown>;
    };
    expect(call.variables.url).toBe(ARGS.path);
    expect(call.variables.languageId).toBe('sv-SE');
  });

  it('returns null when alias misses and urlHistory has no newUrl', async () => {
    mockGraphqlQuery.mockResolvedValue({
      urlHistory: { oldUrl: '/se/sv/old', newUrl: '' },
    });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toBeNull();
  });
});
