import { describe, it, expect, vi, beforeEach } from 'vitest';

// Geins answers no widget area for a published page without blocks; `cmsPages`
// is what still lists it. Mocked at the SDK boundary.
const mockQuery = vi.fn();
const mockLoadQuery = vi.fn().mockReturnValue('query cmsPagesList');
const mockWarn = vi.fn();
const wrapServiceCall = vi.fn(async (fn: () => Promise<unknown>) => fn());
const getPreviewCookie = vi.fn().mockReturnValue(false);
const getRequestLocale = vi.fn().mockReturnValue('sv-SE');
const getRequestMarket = vi.fn().mockReturnValue('se');

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    core: { graphql: { query: mockQuery } },
  }),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: 'ch1', languageId: 'sv-SE', marketId: 'se' }),
  buildRequestContext: vi.fn().mockReturnValue(undefined),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: (path: string) => mockLoadQuery(path),
}));

vi.mock('../../../server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: mockWarn, error: vi.fn(), debug: vi.fn() },
}));

const event = (hostname = 'test.com') =>
  ({ context: { tenant: { hostname } } }) as unknown as import('h3').H3Event;

const TOM = {
  id: 26,
  alias: 'tom-page-test',
  name: 'tom page test',
  title: 'Tom page test',
  tags: ['#menu', null],
  meta: { title: 'Meta title', description: 'Meta description' },
};
const LIST = { cmsPages: [{ id: 1, alias: 'ansok-om-konto', name: 'x' }, TOM] };

describe('getListedCmsPage', () => {
  let getListedCmsPage: typeof import('../../../server/services/cms').getListedCmsPage;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    getPreviewCookie.mockReturnValue(false);
    getRequestLocale.mockReturnValue('sv-SE');
    getRequestMarket.mockReturnValue('se');
    vi.stubGlobal('wrapServiceCall', wrapServiceCall);
    vi.stubGlobal('getPreviewCookie', getPreviewCookie);
    vi.stubGlobal('getRequestLocale', getRequestLocale);
    vi.stubGlobal('getRequestMarket', getRequestMarket);
    vi.stubGlobal('getCookie', () => undefined);
    vi.stubGlobal('getRequestHeader', () => undefined);
    ({ getListedCmsPage } = await import('../../../server/services/cms'));
  });

  it('returns the listed page, with null tags left out', async () => {
    mockQuery.mockResolvedValue(LIST);

    const page = await getListedCmsPage({ alias: 'tom-page-test' }, event());

    expect(page).toEqual({
      id: 26,
      alias: 'tom-page-test',
      name: 'tom page test',
      title: 'Tom page test',
      tags: ['#menu'],
      meta: { title: 'Meta title', description: 'Meta description' },
    });
    expect(mockLoadQuery).toHaveBeenCalledWith('cms/pages.graphql');
    expect(wrapServiceCall).toHaveBeenCalledWith(expect.any(Function), 'cms');
    expect(mockQuery).toHaveBeenCalledWith({
      queryAsString: 'query cmsPagesList',
      variables: { channelId: 'ch1', languageId: 'sv-SE', marketId: 'se' },
    });
  });

  it('returns null for an alias the list does not hold', async () => {
    mockQuery.mockResolvedValue(LIST);

    expect(await getListedCmsPage({ alias: 'fastelement' }, event())).toBe(
      null,
    );
  });

  it('matches the alias exactly, as widgetArea does', async () => {
    mockQuery.mockResolvedValue(LIST);

    expect(await getListedCmsPage({ alias: 'Tom-Page-Test' }, event())).toBe(
      null,
    );
  });

  it('answers no tags for an item without them', async () => {
    mockQuery.mockResolvedValue({
      cmsPages: [{ id: 3, alias: 'x', name: 'x' }],
    });

    expect((await getListedCmsPage({ alias: 'x' }, event()))?.tags).toEqual([]);
  });

  it('skips null items and items without an alias', async () => {
    mockQuery.mockResolvedValue({ cmsPages: [null, { id: 2, name: 'x' }] });

    expect(await getListedCmsPage({ alias: 'x' }, event())).toBe(null);
  });

  it('answers a second call from the cache', async () => {
    mockQuery.mockResolvedValue(LIST);

    await getListedCmsPage({ alias: 'tom-page-test' }, event());
    const again = await getListedCmsPage({ alias: 'ansok-om-konto' }, event());

    expect(again?.id).toBe(1);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('keeps one list per host, locale and market', async () => {
    mockQuery.mockResolvedValue(LIST);

    await getListedCmsPage({ alias: 'tom-page-test' }, event());
    getRequestLocale.mockReturnValue('en-GB');
    await getListedCmsPage({ alias: 'tom-page-test' }, event());
    getRequestMarket.mockReturnValue('de');
    await getListedCmsPage({ alias: 'tom-page-test' }, event());
    await getListedCmsPage({ alias: 'tom-page-test' }, event('other.com'));

    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it('neither reads nor fills the cache in preview', async () => {
    mockQuery.mockResolvedValue(LIST);

    await getListedCmsPage({ alias: 'tom-page-test' }, event());
    getPreviewCookie.mockReturnValue(true);
    await getListedCmsPage({ alias: 'tom-page-test' }, event());
    await getListedCmsPage({ alias: 'tom-page-test' }, event());

    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('leaves the cache empty after a preview read', async () => {
    mockQuery.mockResolvedValue(LIST);

    getPreviewCookie.mockReturnValue(true);
    await getListedCmsPage({ alias: 'tom-page-test' }, event());
    getPreviewCookie.mockReturnValue(false);
    await getListedCmsPage({ alias: 'tom-page-test' }, event());

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('asks again once the 60 s entry has expired', async () => {
    mockQuery.mockResolvedValue(LIST);
    const start = performance.now();
    const now = vi.spyOn(performance, 'now').mockReturnValue(start);
    // lru-cache reuses its last clock reading for 1 ms (ttlResolution).
    const nextClockRead = () => new Promise((r) => setTimeout(r, 5));

    await getListedCmsPage({ alias: 'tom-page-test' }, event());
    now.mockReturnValue(start + 59_000);
    await nextClockRead();
    await getListedCmsPage({ alias: 'tom-page-test' }, event());
    expect(mockQuery).toHaveBeenCalledTimes(1);

    now.mockReturnValue(start + 61_000);
    await nextClockRead();
    await getListedCmsPage({ alias: 'tom-page-test' }, event());
    expect(mockQuery).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('answers null on a failed read, warns, and asks again next time', async () => {
    mockQuery.mockRejectedValueOnce(new Error('timeout'));
    mockQuery.mockResolvedValueOnce(LIST);

    expect(await getListedCmsPage({ alias: 'tom-page-test' }, event())).toBe(
      null,
    );
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('cmsPages read failed'),
    );

    const retried = await getListedCmsPage({ alias: 'tom-page-test' }, event());
    expect(retried?.id).toBe(26);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('answers null on a malformed read, warns, and asks again next time', async () => {
    mockQuery.mockResolvedValueOnce({ cmsPages: 'nope' });
    mockQuery.mockResolvedValueOnce(LIST);

    expect(await getListedCmsPage({ alias: 'tom-page-test' }, event())).toBe(
      null,
    );
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('not a list'),
    );

    const retried = await getListedCmsPage({ alias: 'tom-page-test' }, event());
    expect(retried?.id).toBe(26);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});
