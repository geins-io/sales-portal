import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let search service run for real
// ---------------------------------------------------------------------------
const mockGraphqlQuery = vi.fn();

const mockSDK = {
  core: {
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' },
    graphql: { query: mockGraphqlQuery, mutation: vi.fn() },
  },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
}));

// Mock graphql loader (depends on #graphql-queries build-time alias)
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

// ---------------------------------------------------------------------------
// Stub Nitro / h3 auto-imports
// ---------------------------------------------------------------------------
// eslint-friendly callable type
type AnyFn = (...args: unknown[]) => unknown;

vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getQuery', vi.fn());
vi.stubGlobal(
  'getValidatedQuery',
  vi.fn(async (_event: unknown, validator: (raw: unknown) => unknown) => {
    const query = (getQuery as ReturnType<typeof vi.fn>)(_event);
    return validator(query);
  }),
);
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal('optionalAuth', vi.fn().mockResolvedValue(null));
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue(undefined));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fakeEvent = {} as unknown as import('h3').H3Event;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/search/products', () => {
  let handler: (event: import('h3').H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGraphqlQuery.mockResolvedValue({
      searchProducts: { products: [], count: 0 },
    });
    const mod = await import('../../../server/api/search/products.get.ts');
    handler = mod.default as (event: import('h3').H3Event) => Promise<unknown>;
  });

  it('builds filter with searchText and queries SDK', async () => {
    vi.mocked(getQuery).mockReturnValue({ query: 'shoes' });

    const result = await handler(fakeEvent);

    expect(mockGraphqlQuery).toHaveBeenCalledOnce();
    expect(result).toEqual({ products: [], count: 0 });
  });

  it('includes skip and take in SDK query when provided', async () => {
    vi.mocked(getQuery).mockReturnValue({
      query: 'jackets',
      skip: '0',
      take: '10',
    });

    await handler(fakeEvent);

    expect(mockGraphqlQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          filter: expect.objectContaining({
            searchText: 'jackets',
          }),
          skip: 0,
          take: 10,
        }),
      }),
    );
  });

  it('merges additional filter params', async () => {
    vi.mocked(getQuery).mockReturnValue({
      query: 'boots',
      filter: { color: 'red' },
    });

    await handler(fakeEvent);

    expect(mockGraphqlQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          filter: expect.objectContaining({
            searchText: 'boots',
            color: 'red',
          }),
        }),
      }),
    );
  });

  it('rejects empty query with Zod error', async () => {
    vi.mocked(getQuery).mockReturnValue({ query: '' });

    await expect(handler(fakeEvent)).rejects.toThrow();
  });

  it('rejects query longer than 200 characters', async () => {
    vi.mocked(getQuery).mockReturnValue({ query: 'a'.repeat(201) });

    await expect(handler(fakeEvent)).rejects.toThrow();
  });
});
