import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock at the SDK boundary
// ---------------------------------------------------------------------------
const mockQuery = vi.fn();

const mockSDK = {
  core: {
    graphql: { query: mockQuery },
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' },
  },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: 'ch1', languageId: 'sv-SE', marketId: 'se' }),
  buildRequestContext: vi.fn().mockReturnValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock the graphql loader so it never touches #graphql-queries virtual module
// ---------------------------------------------------------------------------
vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn().mockReturnValue('query placeholder { cmsPages { id } }'),
}));

// ---------------------------------------------------------------------------
// Stub Nitro auto-imports
// ---------------------------------------------------------------------------
const getRequestLocaleMock = vi.fn();
const getRequestMarketMock = vi.fn();

vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));
vi.stubGlobal('getRequestLocale', getRequestLocaleMock);
vi.stubGlobal('getRequestMarket', getRequestMarketMock);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockEvent(hostname = 'test.com') {
  return {
    context: { tenant: { hostname } },
  } as unknown as import('h3').H3Event;
}

describe('getPageLinkByTag', () => {
  let getPageLinkByTag: typeof import('../../../server/services/cms').getPageLinkByTag;
  let getRequestChannelVariablesMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-stub Nitro globals after resetModules
    vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) =>
      fn(),
    );
    vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));
    vi.stubGlobal('getRequestLocale', getRequestLocaleMock);
    vi.stubGlobal('getRequestMarket', getRequestMarketMock);

    // Re-mock after resetModules
    vi.mock('../../../server/services/_sdk', () => ({
      getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
      getRequestChannelVariables: vi
        .fn()
        .mockReturnValue({
          channelId: 'ch1',
          languageId: 'sv-SE',
          marketId: 'se',
        }),
      buildRequestContext: vi.fn().mockReturnValue(undefined),
    }));

    vi.mock('../../../server/services/graphql/loader', () => ({
      loadQuery: vi
        .fn()
        .mockReturnValue('query placeholder { cmsPages { id } }'),
    }));

    const mod = await import('../../../server/services/cms');
    getPageLinkByTag = mod.getPageLinkByTag;

    const sdkMod = await import('../../../server/services/_sdk');
    getRequestChannelVariablesMock =
      sdkMod.getRequestChannelVariables as ReturnType<typeof vi.fn>;

    getRequestLocaleMock.mockReturnValue('sv-SE');
    getRequestMarketMock.mockReturnValue('se');
  });

  it('a. returns the SV canonicalUrl and calls query with correct variables', async () => {
    mockQuery.mockResolvedValue({
      cmsPages: [
        {
          alias: 'kontakt',
          tags: ['contact'],
          canonicalUrl: '/se/sv/kontakt',
        },
      ],
    });

    const result = await getPageLinkByTag({ tag: 'contact' }, mockEvent());

    expect(result).toBe('/se/sv/kontakt');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          includeTags: ['contact'],
          channelId: 'ch1',
          languageId: 'sv-SE',
          marketId: 'se',
        }),
      }),
    );
  });

  it('b. returns null when cmsPages is empty', async () => {
    mockQuery.mockResolvedValue({ cmsPages: [] });

    const result = await getPageLinkByTag({ tag: 'contact' }, mockEvent());

    expect(result).toBeNull();
  });

  it('b. returns null when cmsPages is null', async () => {
    mockQuery.mockResolvedValue({ cmsPages: null });

    const result = await getPageLinkByTag({ tag: 'contact' }, mockEvent());

    expect(result).toBeNull();
  });

  it('b. returns null when cmsPages is undefined', async () => {
    mockQuery.mockResolvedValue({ cmsPages: undefined });

    const result = await getPageLinkByTag({ tag: 'contact' }, mockEvent());

    expect(result).toBeNull();
  });

  it('c. returns null when the only page has an empty canonicalUrl', async () => {
    mockQuery.mockResolvedValue({
      cmsPages: [{ alias: 'contact', tags: ['contact'], canonicalUrl: '' }],
    });

    const result = await getPageLinkByTag({ tag: 'contact' }, mockEvent());

    expect(result).toBeNull();
  });

  it('c. returns null when the only page has a missing canonicalUrl', async () => {
    mockQuery.mockResolvedValue({
      cmsPages: [{ alias: 'contact', tags: ['contact'] }],
    });

    const result = await getPageLinkByTag({ tag: 'contact' }, mockEvent());

    expect(result).toBeNull();
  });

  it('d. caches: two calls with same locale call mockQuery once', async () => {
    mockQuery.mockResolvedValue({
      cmsPages: [
        {
          alias: 'kontakt',
          tags: ['contact'],
          canonicalUrl: '/se/sv/kontakt',
        },
      ],
    });

    const result1 = await getPageLinkByTag({ tag: 'contact' }, mockEvent());
    const result2 = await getPageLinkByTag({ tag: 'contact' }, mockEvent());

    expect(result1).toBe('/se/sv/kontakt');
    expect(result2).toBe('/se/sv/kontakt');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('d. a cached null is also reused', async () => {
    mockQuery.mockResolvedValue({ cmsPages: [] });

    const result1 = await getPageLinkByTag({ tag: 'contact' }, mockEvent());
    const result2 = await getPageLinkByTag({ tag: 'contact' }, mockEvent());

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('f. defensive fallback: uses firstWithUrl when no row matches the requested tag', async () => {
    // The API pre-filters by includeTags; this row has a different tag but
    // still carries a canonicalUrl. The defensive firstWithUrl branch picks it up.
    mockQuery.mockResolvedValue({
      cmsPages: [{ alias: 'x', tags: ['other'], canonicalUrl: '/se/sv/x' }],
    });

    const result = await getPageLinkByTag({ tag: 'contact' }, mockEvent());

    expect(result).toBe('/se/sv/x');
  });

  it('e. locale isolation: sv-SE and en-US calls use distinct cache keys', async () => {
    getRequestChannelVariablesMock
      .mockReturnValueOnce({
        channelId: 'ch1',
        languageId: 'sv-SE',
        marketId: 'se',
      })
      .mockReturnValueOnce({
        channelId: 'ch1',
        languageId: 'en-US',
        marketId: 'se',
      });

    getRequestLocaleMock
      .mockReturnValueOnce('sv-SE')
      .mockReturnValueOnce('en-US');

    mockQuery
      .mockResolvedValueOnce({
        cmsPages: [
          {
            alias: 'kontakt',
            tags: ['contact'],
            canonicalUrl: '/se/sv/kontakt',
          },
        ],
      })
      .mockResolvedValueOnce({
        cmsPages: [
          {
            alias: 'contact',
            tags: ['contact'],
            canonicalUrl: '/se/en/contact',
          },
        ],
      });

    const svResult = await getPageLinkByTag({ tag: 'contact' }, mockEvent());
    const enResult = await getPageLinkByTag({ tag: 'contact' }, mockEvent());

    expect(svResult).toBe('/se/sv/kontakt');
    expect(enResult).toBe('/se/en/contact');
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});
