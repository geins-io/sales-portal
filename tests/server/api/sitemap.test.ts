import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// The real category service runs: mocking it would put the mock boundary ABOVE
// the fetcher, and the fetcher's fallback is exactly what regressed here.
const mockGraphqlQuery = vi.fn();

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    core: {
      geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se', tld: 'se' },
      graphql: { query: mockGraphqlQuery },
    },
  }),
  getChannelVariables: vi.fn((_sdk, locale: string, market: string) => ({
    channelId: '1|se',
    languageId: locale,
    marketId: market,
  })),
  getRequestChannelVariables: vi.fn(),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
}));
vi.mock('../../../server/services/graphql/unwrap', () => ({
  unwrapGraphQL: vi.fn((r: unknown) => r),
}));

vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('defineCachedFunction', (fn: unknown) => fn);

const handler = (await import('../../../server/api/__sitemap__/urls'))
  .default as unknown as (event: H3Event) => Promise<{ loc: string }[]>;

const event = {
  context: {
    tenant: {
      config: {
        geinsSettings: {
          availableMarkets: ['se'],
          availableLocales: ['sv-SE', 'fi-FI'],
        },
      },
    },
  },
} as unknown as H3Event;

/** Answer the category-tree query per language; everything else is empty. */
const treePerLanguage = (trees: Record<string, unknown>) =>
  mockGraphqlQuery.mockImplementation(
    async (args: {
      queryAsString: string;
      variables: { languageId: string };
    }) =>
      args.queryAsString.includes('category-tree')
        ? (trees[args.variables.languageId] ?? [])
        : [],
  );

const CATEGORY = {
  categoryId: 1,
  parentCategoryId: 0,
  name: 'Epoxy',
  alias: 'epoxy',
};

beforeEach(() => {
  mockGraphqlQuery.mockReset().mockResolvedValue([]);
});

describe('sitemap urls', () => {
  it('publishes a category for every locale that has a tree', async () => {
    treePerLanguage({ 'sv-SE': [CATEGORY], 'fi-FI': [CATEGORY] });

    const locs = (await handler(event)).map((e) => e.loc);

    expect(locs).toContain('/se/sv/c/epoxy');
    expect(locs).toContain('/se/fi/c/epoxy');
  });

  it('publishes NOTHING for a locale with no tree of its own', async () => {
    // The category tree is shared with the breadcrumb. When that fetcher fell
    // back to the default language, tenant-a's sitemap grew by 80 URLs: Swedish
    // aliases advertised under its fi and nb prefixes. The breadcrumb falls back
    // in its own caller so this endpoint stays honest about what is published.
    treePerLanguage({ 'sv-SE': [CATEGORY] });

    const locs = (await handler(event)).map((e) => e.loc);

    expect(locs).toContain('/se/sv/c/epoxy');
    expect(locs).not.toContain('/se/fi/c/epoxy');
    // The locale's own root entry is unaffected — only its categories go.
    expect(locs).toContain('/se/fi/');
  });
});
