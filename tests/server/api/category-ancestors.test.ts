import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — the tree fetch, its locale fallback and its cache
// key are what is under test
// ---------------------------------------------------------------------------
const mockGraphqlQuery = vi.fn();

const mockSDK = {
  core: {
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' },
    graphql: { query: mockGraphqlQuery },
  },
};

// The requested language/market drive the fallback and the cache key.
let requestedLanguageId = 'sv-SE';
let requestedMarketId = 'se';

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi.fn(() => ({
    channelId: '1',
    languageId: requestedLanguageId,
    marketId: requestedMarketId,
  })),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
}));
vi.mock('../../../server/services/graphql/unwrap', () => ({
  unwrapGraphQL: vi.fn((r: unknown) => r),
}));

vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
// defineCachedFunction is a Nitro auto-import. Pass the function straight
// through so the fetch stays observable; the cache KEY is asserted directly.
vi.stubGlobal('defineCachedFunction', (fn: unknown) => fn);

const { getCategoryTree, categoryTreeCacheKey, resolveTenantCacheKey } =
  await import('../../../server/services/categories');

const TREE = [
  {
    categoryId: 1,
    parentCategoryId: 0,
    name: 'Fästelement',
    alias: 'fastelement',
    canonicalUrl: '/se/sv/c/fastelement',
  },
];

const eventFor = (tenant: Record<string, unknown>) =>
  ({ context: { tenant } }) as unknown as H3Event;

const event = eventFor({ tenantId: 't1', hostname: 'a.example.com' });

const langOf = (call: number) =>
  (
    mockGraphqlQuery.mock.calls[call]?.[0] as {
      variables: { languageId: string };
    }
  ).variables.languageId;

beforeEach(() => {
  requestedLanguageId = 'sv-SE';
  requestedMarketId = 'se';
  mockGraphqlQuery.mockReset();
  mockGraphqlQuery.mockResolvedValue(TREE);
});

describe('categoryTreeCacheKey', () => {
  const vars = { channelId: '1', languageId: 'sv-SE', marketId: 'se' };

  it('separates tenants', () => {
    expect(categoryTreeCacheKey('t1', vars)).not.toBe(
      categoryTreeCacheKey('t2', vars),
    );
  });

  it('separates languages — the tree carries display names', () => {
    expect(categoryTreeCacheKey('t1', vars)).not.toBe(
      categoryTreeCacheKey('t1', { ...vars, languageId: 'en-GB' }),
    );
  });

  it('separates markets — canonicalUrl carries the market', () => {
    // A tenant running both `se` and `fi` would otherwise get Swedish-market
    // URLs served to its Finnish market.
    expect(categoryTreeCacheKey('t1', vars)).not.toBe(
      categoryTreeCacheKey('t1', { ...vars, marketId: 'fi' }),
    );
  });

  it('contains no path separator', () => {
    // unstorage reads ':' and '/' as path separators, so such a key nests into
    // directories instead of writing one file. Entries stay distinct either
    // way; flat keys just make a stale entry findable and deletable, which
    // matters because `swr: true` never expires one on its own.
    const key = categoryTreeCacheKey(
      resolveTenantCacheKey(eventFor({ tenantId: 't1' })),
      vars,
    );
    expect(key).not.toMatch(/[:/]/);
  });

  it('keys on tenantId, falling back to hostname', () => {
    // Two hostnames for one tenant must warm ONE entry, not one each.
    expect(
      resolveTenantCacheKey(
        eventFor({ tenantId: 't1', hostname: 'a.example.com' }),
      ),
    ).toBe(
      resolveTenantCacheKey(
        eventFor({ tenantId: 't1', hostname: 'b.example.com' }),
      ),
    );
    expect(
      resolveTenantCacheKey(eventFor({ hostname: 'c.example.com' })),
    ).toContain('c.example.com');
  });
});

describe('getCategoryTree', () => {
  it('returns the tree for the request language and market', async () => {
    await expect(getCategoryTree(event)).resolves.toEqual(TREE);
    expect(mockGraphqlQuery).toHaveBeenCalledTimes(1);
    expect(langOf(0)).toBe('sv-SE');
  });

  it('THROWS rather than returns on an empty or non-array tree', async () => {
    // Nitro caches a returned value, not a thrown error. Returning [] here
    // would pin an empty tree for the whole window and erase every breadcrumb
    // on the tenant — silently, and cluster-wide once Redis is attached.
    mockGraphqlQuery.mockResolvedValue([]);
    await expect(getCategoryTree(event)).rejects.toThrow(
      'Category tree unavailable',
    );

    mockGraphqlQuery.mockResolvedValue(null);
    await expect(getCategoryTree(event)).rejects.toThrow(
      'Category tree unavailable',
    );

    mockGraphqlQuery.mockResolvedValue({ not: 'an array' });
    await expect(getCategoryTree(event)).rejects.toThrow(
      'Category tree unavailable',
    );
  });

  it('does NOT fall back to another language', async () => {
    // The sitemap shares this fetcher. Retrying into the default language made
    // tenant-a publish 80 Swedish-alias URLs under its fi and nb prefixes.
    requestedLanguageId = 'de-DE';
    mockGraphqlQuery.mockResolvedValue([]);

    await expect(getCategoryTree(event)).rejects.toThrow(
      'Category tree unavailable',
    );
    expect(mockGraphqlQuery).toHaveBeenCalledTimes(1);
    expect(langOf(0)).toBe('de-DE');
  });

  it('accepts an explicit channel context, as the sitemap needs', async () => {
    await getCategoryTree(event, {
      channelId: '1',
      languageId: 'fi-FI',
      marketId: 'fi',
    });
    expect(langOf(0)).toBe('fi-FI');
  });
});

describe('resolveEntityAncestors', () => {
  const loadWithTree = async (getCategoryTreeImpl: () => unknown) => {
    vi.resetModules();
    vi.doMock('../../../server/services/categories', () => ({
      getCategoryTree: vi.fn(getCategoryTreeImpl),
      getChannelContext: vi.fn(async () => ({
        vars: { channelId: '1', languageId: 'de-DE', marketId: 'se' },
        defaultLanguageId: 'sv-SE',
      })),
    }));
    const mod = await import('../../../server/utils/breadcrumb-ancestors');
    return mod.resolveEntityAncestors;
  };

  const eventWithTenant = {
    context: { tenant: { hostname: 'test.example.com' } },
  } as unknown as H3Event;

  const DEEP = [
    {
      categoryId: 1,
      parentCategoryId: 0,
      name: 'A',
      canonicalUrl: '/se/sv/c/a',
    },
    {
      categoryId: 2,
      parentCategoryId: 1,
      name: 'B',
      canonicalUrl: '/se/sv/c/a/b',
    },
  ];

  it('walks the tree from the category id', async () => {
    const resolveEntityAncestors = await loadWithTree(async () => DEEP);
    await expect(resolveEntityAncestors(2, eventWithTenant)).resolves.toEqual([
      { name: 'A', canonicalUrl: '/se/sv/c/a' },
    ]);
  });

  it('yields no crumbs for a top-level category', async () => {
    const resolveEntityAncestors = await loadWithTree(async () => DEEP);
    await expect(resolveEntityAncestors(1, eventWithTenant)).resolves.toEqual(
      [],
    );
  });

  it('treats a thrown requested-language fetch as "not found here"', async () => {
    const spy = vi.fn(async (_e: unknown, vars?: { languageId: string }) => {
      if (vars?.languageId !== 'sv-SE')
        throw new Error('Category tree unavailable');
      return DEEP;
    });
    const resolveEntityAncestors = await loadWithTree(
      spy as unknown as () => unknown,
    );

    await expect(resolveEntityAncestors(2, eventWithTenant)).resolves.toEqual([
      { name: 'A', canonicalUrl: '/se/sv/c/a' },
    ]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('retries against the default-language tree when it lacks the category', async () => {
    // Measured on sonoralab: the de-DE tree returns 7 of 12 categories. It is
    // non-empty, so the fetch's own empty-tree fallback never fires — only the
    // caller knows which category is missing.
    const spy = vi.fn(async (_e: unknown, vars?: { languageId: string }) =>
      vars?.languageId === 'sv-SE' ? DEEP : [DEEP[0]],
    );
    const resolveEntityAncestors = await loadWithTree(
      spy as unknown as () => unknown,
    );

    await expect(resolveEntityAncestors(2, eventWithTenant)).resolves.toEqual([
      { name: 'A', canonicalUrl: '/se/sv/c/a' },
    ]);
    expect(spy).toHaveBeenCalledTimes(2);
    expect((spy.mock.calls[1]?.[1] as { languageId: string }).languageId).toBe(
      'sv-SE',
    );
  });

  it('makes no call at all without a category id', async () => {
    const spy = vi.fn(async () => DEEP);
    const resolveEntityAncestors = await loadWithTree(spy);
    await expect(
      resolveEntityAncestors(undefined, eventWithTenant),
    ).resolves.toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('swallows a tree failure into an empty chain', async () => {
    // A breadcrumb must never turn a rendering page into an error. The page
    // falls back to its single crumb, which is what an unresolved chain gives
    // anyway, so the failure path and the missing-data path agree.
    const resolveEntityAncestors = await loadWithTree(() => {
      throw new Error('Category tree unavailable');
    });
    await expect(resolveEntityAncestors(2, eventWithTenant)).resolves.toEqual(
      [],
    );
  });

  it('refuses a partially resolved chain', async () => {
    const resolveEntityAncestors = await loadWithTree(async () => [DEEP[1]]);
    await expect(resolveEntityAncestors(2, eventWithTenant)).resolves.toEqual(
      [],
    );
  });
});
