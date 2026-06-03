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

  // ---------------------------------------------------------------------------
  // Priority order: product > category > brand
  // ---------------------------------------------------------------------------

  it('returns product (priority) when product, category, and brand all resolve', async () => {
    // Geins returns prefix-less canonicals: /se/sv/{slug} (no /p/ or /l/ prefix here)
    mockGetProduct.mockResolvedValue({
      canonicalUrl: '/se/sv/material/grenror/grenror-150-150-88',
    });
    mockGetCategoryPage.mockResolvedValue({
      canonicalUrl: '/se/sv/l/material',
    });
    mockGetBrandPage.mockResolvedValue({
      canonicalUrl: '/se/sv/b/grenror-brand',
    });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({
      type: 'product',
      canonicalAppPath: '/se/sv/p/material/grenror/grenror-150-150-88',
    });
    expect(mockGraphqlQuery).not.toHaveBeenCalled();
  });

  it('returns category when product is null (preserves market/locale, maps /l/ -> /c/)', async () => {
    mockGetCategoryPage.mockResolvedValue({
      canonicalUrl: '/se/sv/l/material',
    });
    mockGetBrandPage.mockResolvedValue({
      canonicalUrl: '/se/sv/b/grenror-brand',
    });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({
      type: 'category',
      canonicalAppPath: '/se/sv/c/material',
    });
  });

  it('returns brand when product and category are null', async () => {
    mockGetBrandPage.mockResolvedValue({
      canonicalUrl: '/se/sv/b/grenror-brand',
    });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({
      type: 'brand',
      canonicalAppPath: '/se/sv/b/grenror-brand',
    });
  });

  // ---------------------------------------------------------------------------
  // canonicalAppPath shape: market+locale preserved, correct app prefix
  // ---------------------------------------------------------------------------

  it('maps a raw Geins prefix-less product canonical to /se/sv/p/...', async () => {
    // Geins returns "/se/sv/material/grenror/grenror-150" (no entity prefix)
    mockGetProduct.mockResolvedValue({
      canonicalUrl: '/se/sv/material/grenror/grenror-150',
    });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({
      type: 'product',
      canonicalAppPath: '/se/sv/p/material/grenror/grenror-150',
    });
  });

  it('maps a Geins /l/ category canonical to /se/sv/c/...', async () => {
    // Geins uses /l/ prefix for category list URLs
    mockGetCategoryPage.mockResolvedValue({
      canonicalUrl: '/se/sv/l/category-name',
    });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({
      type: 'category',
      canonicalAppPath: '/se/sv/c/category-name',
    });
  });

  it('ignores an entity whose canonicalUrl is empty and falls through', async () => {
    mockGetProduct.mockResolvedValue({ canonicalUrl: '' });
    mockGetCategoryPage.mockResolvedValue({
      canonicalUrl: '/se/sv/l/material',
    });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({
      type: 'category',
      canonicalAppPath: '/se/sv/c/material',
    });
  });

  it('treats a malformed canonical (no market/locale, too few segments) as no-match and falls through', async () => {
    // alternateEntityPath returns null for < 3 segments after splitting
    mockGetProduct.mockResolvedValue({ canonicalUrl: '/only-one-segment' });
    mockGetCategoryPage.mockResolvedValue({ canonicalUrl: '/se/sv/l/good' });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    // product had a malformed canonical -> fell through to category
    expect(result).toEqual({
      type: 'category',
      canonicalAppPath: '/se/sv/c/good',
    });
  });

  it('tolerates a thrown not-found from one resolver (allSettled)', async () => {
    mockGetProduct.mockRejectedValue(new Error('not found'));
    mockGetCategoryPage.mockResolvedValue({
      canonicalUrl: '/se/sv/l/material',
    });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({
      type: 'category',
      canonicalAppPath: '/se/sv/c/material',
    });
  });

  // ---------------------------------------------------------------------------
  // urlHistory (renamed slugs)
  // ---------------------------------------------------------------------------

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

  it('returns null when alias misses and urlHistory is null', async () => {
    mockGraphqlQuery.mockResolvedValue({ urlHistory: null });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toBeNull();
  });
});
