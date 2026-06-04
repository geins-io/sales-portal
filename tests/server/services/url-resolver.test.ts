import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// Mock the entity-resolver services and the SDK boundary.
// The resolver under test composes getProduct / getCategoryPage / getBrandPage
// and the urlHistory GraphQL query; we mock all three services and the SDK.
// unwrapGraphQL is a pure internal utility -- use the REAL implementation so
// tests catch regressions in the unwrap logic itself rather than a mock copy.
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

// Use the REAL unwrapGraphQL -- it is a pure internal utility with no external
// deps (no SDK, no Nitro, no network). Mocking it was a verbatim copy that
// would miss regressions in the actual implementation.

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
  // Requested-locale recovery: a default-locale canonical must not bounce a
  // non-default-locale request out of its locale.
  // ---------------------------------------------------------------------------

  it('recovers in the requested locale when the canonical is the default locale', async () => {
    // Requested EN, but Geins returns the Swedish canonical for the category.
    mockGetCategoryPage.mockResolvedValue({ canonicalUrl: '/se/sv/c/kabel' });

    const result = await resolver.resolveEntityUrl(
      { path: '/se/en/kabel', alias: 'kabel' },
      createMockEvent(),
    );

    expect(result).toEqual({
      type: 'category',
      canonicalAppPath: '/se/en/c/kabel',
    });
  });

  it('recovers a Geins /l/ canonical in the requested EN locale', async () => {
    mockGetCategoryPage.mockResolvedValue({ canonicalUrl: '/se/sv/l/kabel' });

    const result = await resolver.resolveEntityUrl(
      { path: '/se/en/l/kabel', alias: 'kabel' },
      createMockEvent(),
    );

    expect(result).toEqual({
      type: 'category',
      canonicalAppPath: '/se/en/c/kabel',
    });
  });

  it('keeps the canonical own prefix for a prefix-less request (tenant-a dev)', async () => {
    mockGetProduct.mockResolvedValue({
      canonicalUrl: '/se/sv/material/grenror',
    });

    const result = await resolver.resolveEntityUrl(
      { path: '/grenror', alias: 'grenror' },
      createMockEvent(),
    );

    expect(result).toEqual({
      type: 'product',
      canonicalAppPath: '/se/sv/p/material/grenror',
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

  // ---------------------------------------------------------------------------
  // Open-redirect guard: an unsafe urlHistory.newUrl must NOT surface as a
  // redirect. localePath() and a Location header pass http(s):// and
  // protocol-relative // through unchanged, so an off-origin newUrl would 301
  // the browser off this origin. Treat any unsafe value as a no-match (null).
  // ---------------------------------------------------------------------------
  it.each([
    ['absolute https URL', 'https://evil.example.com/phish'],
    ['protocol-relative URL', '//evil.example.com/phish'],
    ['backslash-escaped host', '/\\evil.example.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['embedded scheme', '/se/sv/http://evil.com'],
    ['no leading slash', 'se/sv/new-slug'],
  ])(
    'returns null (no-match) when urlHistory.newUrl is an unsafe %s',
    async (_label, newUrl) => {
      mockGraphqlQuery.mockResolvedValue({
        urlHistory: { oldUrl: '/se/sv/old', newUrl },
      });

      const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

      expect(result).toBeNull();
    },
  );

  it('returns { redirect } only when urlHistory.newUrl is a safe in-app path', async () => {
    mockGraphqlQuery.mockResolvedValue({
      urlHistory: { oldUrl: '/se/sv/old', newUrl: '/se/sv/new-slug' },
    });

    const result = await resolver.resolveEntityUrl(ARGS, createMockEvent());

    expect(result).toEqual({ redirect: '/se/sv/new-slug' });
  });
});
