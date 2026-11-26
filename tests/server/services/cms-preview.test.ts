import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// The CMS preview token is a key to CMS content, not a sign-in. Measured on a
// registered tenant: with `preview: true` and a draft token Geins answers EVERY
// area with the draft, so a category page rendered the start page's draft. The
// token alone brings the draft in its own area only, spoofed date included.

vi.mock('../../../server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockAreaGet = vi.fn();
const mockPageGet = vi.fn();
const mockMenuGet = vi.fn();
const mockQuery = vi.fn();

const channelVars = { channelId: '1', languageId: 'sv-SE', marketId: 'se' };

type CookieBag = { _cookies?: Record<string, string | undefined> };

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    cms: {
      area: { get: (...args: unknown[]) => mockAreaGet(...args) },
      page: { get: (...args: unknown[]) => mockPageGet(...args) },
      menu: { get: (...args: unknown[]) => mockMenuGet(...args) },
    },
    core: { graphql: { query: (...args: unknown[]) => mockQuery(...args) } },
  }),
  getRequestChannelVariables: vi.fn().mockReturnValue(channelVars),
  getChannelVariables: vi.fn().mockReturnValue(channelVars),
  // Mirrors the real one: locale plus the session token.
  buildRequestContext: vi.fn((event: CookieBag) => {
    const token = event._cookies?.auth_token;
    return { languageId: 'sv-SE', ...(token && { userToken: token }) };
  }),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn().mockReturnValue('query placeholder'),
}));

vi.stubGlobal(
  'getCookie',
  (event: CookieBag, name: string) => event?._cookies?.[name],
);
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue('sv-SE'));
vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue('se'));
vi.stubGlobal('getRequestHeader', vi.fn().mockReturnValue(undefined));
// cms.ts must not decide preview on this cookie any more.
vi.stubGlobal(
  'getPreviewCookie',
  vi.fn(() => {
    throw new Error('preview is decided on the preview token');
  }),
);

const {
  getContentArea,
  getPage,
  getMenu,
  getListedCmsPage,
  getPageLinkByTag,
  readPreviewPageDraft,
} = await import('../../../server/services/cms');

const PREVIEW = 'preview-jwt';
const BUYER = 'buyer-jwt';

function event(
  cookies: Record<string, string> = {},
  hostname = 'test.com',
): H3Event {
  return {
    context: { tenant: { hostname } },
    _cookies: cookies,
  } as unknown as H3Event;
}
const inPreview = (extra: Record<string, string> = {}) =>
  event({ cms_preview_token: PREVIEW, preview_mode: 'true', ...extra });
/** Only the preview token: the cache rule must hang on it, not on preview_mode. */
const tokenOnly = (hostname?: string) =>
  event({ cms_preview_token: PREVIEW }, hostname);

const AREA = {
  containers: [{ id: 'c1', content: [{ id: 'w1' }] }],
};
const MENU = { menuItems: [{ id: 'm1' }] };
const timedOut = () => new Error('timed out');

let n = 0;
const unique = (base: string) => `${base}-${++n}`;

beforeEach(() => {
  vi.clearAllMocks();
  mockAreaGet.mockResolvedValue(AREA);
  mockPageGet.mockResolvedValue({ content: '' });
  mockMenuGet.mockResolvedValue(MENU);
  mockQuery.mockResolvedValue({ cmsPages: [] });
});

describe('CMS reads in preview send the preview token, never a preview flag', () => {
  it('area: both legs carry the preview token and no preview key', async () => {
    await getContentArea(
      { family: 'Start', areaName: unique('a') },
      inPreview(),
    );

    expect(mockAreaGet).toHaveBeenCalledTimes(2);
    for (const call of mockAreaGet.mock.calls) {
      expect(call[0]).not.toHaveProperty('preview');
      expect(call[1]).toEqual({ languageId: 'sv-SE', userToken: PREVIEW });
    }
  });

  it('area: an empty preview answer is the answer, with no second read', async () => {
    mockAreaGet.mockResolvedValue({ containers: [] });

    await getContentArea(
      { family: 'Start', areaName: unique('a') },
      inPreview(),
    );

    expect(mockAreaGet).toHaveBeenCalledTimes(2);
  });

  it('area: the preview token wins over a signed-in buyer for CMS', async () => {
    await getContentArea(
      { family: 'Start', areaName: unique('a') },
      inPreview({ auth_token: BUYER }),
    );

    for (const call of mockAreaGet.mock.calls) {
      expect(call[1]).toEqual({ languageId: 'sv-SE', userToken: PREVIEW });
    }
  });

  it('area: without a preview token the session token is sent', async () => {
    await getContentArea(
      { family: 'Start', areaName: unique('a') },
      event({ auth_token: BUYER }),
    );

    for (const call of mockAreaGet.mock.calls) {
      expect(call[1]).toEqual({ languageId: 'sv-SE', userToken: BUYER });
    }
  });

  it('menu: one read with the preview token and no preview key', async () => {
    await getMenu({ menuLocationId: unique('m') }, inPreview());

    expect(mockMenuGet).toHaveBeenCalledTimes(1);
    expect(mockMenuGet.mock.calls[0]![0]).not.toHaveProperty('preview');
    expect(mockMenuGet.mock.calls[0]![1]).toEqual({
      languageId: 'sv-SE',
      userToken: PREVIEW,
    });
  });

  it('menu: the language fallback keeps the preview token and drops the language', async () => {
    mockMenuGet.mockResolvedValueOnce({ menuItems: [] });
    const menuLocationId = unique('m');

    const menu = await getMenu({ menuLocationId }, inPreview());

    expect(menu).toEqual(MENU);
    expect(mockMenuGet).toHaveBeenCalledTimes(2);
    const { languageId: _l, ...withoutLanguage } = channelVars;
    expect(mockMenuGet).toHaveBeenLastCalledWith(
      { menuLocationId, depth: 3, ...withoutLanguage },
      { userToken: PREVIEW },
    );
  });

  it('cmsPages: no user token, preview or not', async () => {
    await getListedCmsPage({ alias: 'x' }, inPreview({ auth_token: BUYER }));

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0]).toHaveLength(1);
    const [options] = mockQuery.mock.calls[0]!;
    expect(options).not.toHaveProperty('userToken');
    expect(options.variables).not.toHaveProperty('userToken');
  });

  it('pageLink: no user token, preview or not', async () => {
    await getPageLinkByTag(
      { tag: unique('t') },
      inPreview({ auth_token: BUYER }),
    );

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0]).toHaveLength(1);
    const [options] = mockQuery.mock.calls[0]!;
    expect(options).not.toHaveProperty('userToken');
    expect(options.variables).not.toHaveProperty('userToken');
  });
});

// Measured on a registered tenant: Geins answers a page draft only to a read
// with `preview: true`, and then answers it for ANY alias (and any area). The
// page read carries the flag in preview, and shows that answer only when it is
// a page draft that belongs to the URL.
describe('page reads in preview', () => {
  // What the SDK makes of a null widget area, and of the measured answers.
  const NO_PAGE = {
    id: '',
    name: '',
    title: '',
    pageArea: {},
    familyName: '',
    containers: [],
  };
  // Measured: a page, published or draft, has page area 0 and no family.
  const PAGE_AREA = { id: '0', index: 0 };
  const BLOCKS = [{ id: 'c1', content: [{ id: 'w1' }] }];
  const PUBLISHED_IMAGES = {
    id: '25',
    name: 'Images test',
    title: 'Images',
    pageArea: PAGE_AREA,
    containers: BLOCKS,
  };
  const NEW_PAGE_DRAFT = {
    id: '33',
    name: 'test page draft',
    title: 'test page draft',
    pageArea: PAGE_AREA,
    containers: BLOCKS,
  };

  /** own = the token-only read, draft = the read with `preview: true`. */
  function pageReads(own: object, draft: object | Error) {
    mockPageGet.mockImplementation(async (args: { preview?: boolean }) => {
      if (!args.preview) return own;
      if (draft instanceof Error) throw draft;
      return draft;
    });
  }
  it('sends no flag and makes one read without a preview token', async () => {
    pageReads(PUBLISHED_IMAGES, NEW_PAGE_DRAFT);

    const page = await getPage(
      { alias: 'images' },
      event({ auth_token: BUYER, preview_mode: 'true' }),
    );

    expect(page).toBe(PUBLISHED_IMAGES);
    expect(mockPageGet).toHaveBeenCalledTimes(1);
    expect(mockPageGet).toHaveBeenCalledWith(
      { alias: 'images', ...channelVars },
      { languageId: 'sv-SE', userToken: BUYER },
    );
  });

  it('reads with the preview token, once without the flag and once with it', async () => {
    pageReads(PUBLISHED_IMAGES, NEW_PAGE_DRAFT);

    await getPage(
      { alias: 'images', customerType: 'ORGANIZATION' as never },
      inPreview({ auth_token: BUYER }),
    );

    const own = {
      alias: 'images',
      ...channelVars,
      customerType: 'ORGANIZATION',
    };
    const ctx = { languageId: 'sv-SE', userToken: PREVIEW };
    expect(mockPageGet).toHaveBeenCalledTimes(2);
    expect(mockPageGet).toHaveBeenCalledWith(own, ctx);
    expect(mockPageGet).toHaveBeenCalledWith({ ...own, preview: true }, ctx);
  });

  it('shows a never-published page draft on the alias its title gives', async () => {
    pageReads(NO_PAGE, NEW_PAGE_DRAFT);

    const page = await getPage({ alias: 'test-page-draft' }, inPreview());

    expect(page).toBe(NEW_PAGE_DRAFT);
  });

  it('shows the published page, not the draft, on another published alias', async () => {
    pageReads(PUBLISHED_IMAGES, NEW_PAGE_DRAFT);

    const page = await getPage({ alias: 'images' }, inPreview());

    expect(page).toBe(PUBLISHED_IMAGES);
  });

  it('keeps an unknown alias empty, so the route still answers 404', async () => {
    pageReads(NO_PAGE, NEW_PAGE_DRAFT);

    const page = await getPage({ alias: 'no-such-page' }, inPreview());

    expect(page).toBe(NO_PAGE);
  });

  // Measured: the draft of published page 25 answers with its own id (34),
  // never 25, so only its title ties it to the published URL.
  const DRAFT_OF_IMAGES = { ...NEW_PAGE_DRAFT, id: '34', title: 'Images' };

  it('shows the draft of a published page on its URL while the title gives the alias', async () => {
    pageReads(PUBLISHED_IMAGES, DRAFT_OF_IMAGES);

    const page = await getPage({ alias: 'images' }, inPreview());

    expect(page).toBe(DRAFT_OF_IMAGES);
  });

  it('shows a renamed draft on the alias of its new title, not the old URL', async () => {
    const renamed = { ...DRAFT_OF_IMAGES, title: 'Bilder' };
    pageReads(PUBLISHED_IMAGES, renamed);

    expect(await getPage({ alias: 'images' }, inPreview())).toBe(
      PUBLISHED_IMAGES,
    );
    pageReads(NO_PAGE, renamed);
    expect(await getPage({ alias: 'bilder' }, inPreview())).toBe(renamed);
  });

  describe('the published page on the alias has the same title', () => {
    // An alias Geins did not derive from the title as we do.
    const ownAtOddAlias = { ...PUBLISHED_IMAGES, title: 'Smørbrød' };
    const draftOfOdd = { ...DRAFT_OF_IMAGES, title: 'Smørbrød' };

    it('shows the draft', async () => {
      pageReads(ownAtOddAlias, draftOfOdd);

      expect(await getPage({ alias: 'smorbrod' }, inPreview())).toBe(
        draftOfOdd,
      );
    });

    it('not when the titles differ', async () => {
      pageReads(ownAtOddAlias, { ...draftOfOdd, title: 'Smørrebrød' });

      expect(await getPage({ alias: 'smorbrod' }, inPreview())).toBe(
        ownAtOddAlias,
      );
    });

    it('not when the alias has no published page', async () => {
      pageReads({ ...NO_PAGE, title: 'Smørbrød' }, draftOfOdd);

      expect(await getPage({ alias: 'smorbrod' }, inPreview())).toEqual({
        ...NO_PAGE,
        title: 'Smørbrød',
      });
    });

    it('not when both titles are empty', async () => {
      const untitled = { ...PUBLISHED_IMAGES, title: '' };
      pageReads(untitled, { ...DRAFT_OF_IMAGES, title: '' });

      expect(await getPage({ alias: 'images' }, inPreview())).toBe(untitled);
    });
  });

  describe('never puts an area draft on a page URL', () => {
    // Measured shape of an area draft, titled to pass both ties, so only the
    // page-draft check stops it.
    const areaShaped = {
      ...PUBLISHED_IMAGES,
      id: '31',
      familyName: 'Portal (Customer logged in)',
      pageArea: { id: '4', name: 'Above Content', index: 0 },
    };

    it('an area answer, with its family and area set', async () => {
      pageReads(PUBLISHED_IMAGES, areaShaped);

      expect(await getPage({ alias: 'images' }, inPreview())).toBe(
        PUBLISHED_IMAGES,
      );
    });

    it('an answer with only a family set', async () => {
      pageReads(PUBLISHED_IMAGES, { ...areaShaped, pageArea: PAGE_AREA });

      expect(await getPage({ alias: 'images' }, inPreview())).toBe(
        PUBLISHED_IMAGES,
      );
    });

    it('an answer with only a named page area', async () => {
      const { familyName: _f, ...noFamily } = areaShaped;
      pageReads(PUBLISHED_IMAGES, {
        ...noFamily,
        pageArea: { id: '0', name: 'Above Content' },
      });

      expect(await getPage({ alias: 'images' }, inPreview())).toBe(
        PUBLISHED_IMAGES,
      );
    });

    it('an answer with only a page area id', async () => {
      const { familyName: _f, ...noFamily } = areaShaped;
      pageReads(PUBLISHED_IMAGES, { ...noFamily, pageArea: { id: '4' } });

      expect(await getPage({ alias: 'images' }, inPreview())).toBe(
        PUBLISHED_IMAGES,
      );
    });
  });

  it('logs a page draft that is not this page, without the token', async () => {
    const { logger } = await import('../../../server/utils/logger');
    pageReads(PUBLISHED_IMAGES, NEW_PAGE_DRAFT);

    await getPage({ alias: 'images' }, inPreview());

    expect(logger.warn).toHaveBeenCalledWith(
      '[cms] preview page draft is not this page',
      { alias: 'images', draftAlias: 'test-page-draft' },
    );
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(
      PREVIEW,
    );
  });

  it('ignores a draft answer without blocks', async () => {
    pageReads(NO_PAGE, { ...NEW_PAGE_DRAFT, containers: [] });

    const page = await getPage({ alias: 'test-page-draft' }, inPreview());

    expect(page).toBe(NO_PAGE);
  });

  it('shows the page as without the flag when the flag read fails', async () => {
    pageReads(PUBLISHED_IMAGES, timedOut());

    const page = await getPage({ alias: 'images' }, inPreview());

    expect(page).toBe(PUBLISHED_IMAGES);
  });

  it('shows the draft when the read without the flag fails', async () => {
    mockPageGet.mockImplementation(async (args: { preview?: boolean }) => {
      if (args.preview) return DRAFT_OF_IMAGES;
      throw timedOut();
    });

    expect(await getPage({ alias: 'images' }, inPreview())).toBe(
      DRAFT_OF_IMAGES,
    );
  });

  it('fails as before when the read without the flag fails and the draft is not this page', async () => {
    mockPageGet.mockImplementation(async (args: { preview?: boolean }) => {
      if (args.preview) return NEW_PAGE_DRAFT;
      throw timedOut();
    });

    await expect(getPage({ alias: 'images' }, inPreview())).rejects.toThrow(
      'timed out',
    );
  });
});

describe('the preview page draft, for the landing URL', () => {
  const draft = {
    id: '33',
    title: 'test page draft',
    pageArea: { id: '0', index: 0 },
    containers: AREA.containers,
  };

  it('reads with the given token and the flag, in the language of the path', async () => {
    mockPageGet.mockResolvedValue(draft);
    const { getChannelVariables } =
      await import('../../../server/services/_sdk');
    vi.mocked(getChannelVariables).mockReturnValue({
      channelId: '1',
      languageId: 'fi-FI',
      marketId: 'fi',
    });

    const found = await readPreviewPageDraft(
      event({ auth_token: BUYER, cms_preview_token: PREVIEW }),
      'entry-jwt',
      '/fi/fi/',
    );

    expect(found).toBe(draft);
    expect(getChannelVariables).toHaveBeenCalledWith(
      expect.anything(),
      'fi',
      'fi',
      undefined,
    );
    expect(mockPageGet).toHaveBeenCalledWith(
      {
        alias: expect.any(String),
        channelId: '1',
        languageId: 'fi-FI',
        marketId: 'fi',
        preview: true,
      },
      { userToken: 'entry-jwt' },
      { timeoutMs: 2500 },
    );
  });

  it('reads in the tenant default language when the path has no prefix', async () => {
    mockPageGet.mockResolvedValue(draft);
    const { getChannelVariables } =
      await import('../../../server/services/_sdk');
    const noChannelSettings = {
      context: { tenant: { hostname: 'test.com', config: {} } },
      _cookies: {},
    } as unknown as H3Event;

    expect(
      await readPreviewPageDraft(noChannelSettings, 'entry-jwt', '/'),
    ).toBe(draft);
    expect(getChannelVariables).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      undefined,
      undefined,
    );
  });

  it('counts an answer without a page area as a page', async () => {
    const { pageArea: _p, ...noPageArea } = draft;
    mockPageGet.mockResolvedValue(noPageArea);

    expect(await readPreviewPageDraft(event(), 'entry-jwt', '/se/sv/')).toBe(
      noPageArea,
    );
  });

  it('answers null for an area draft, an empty answer or a failed read', async () => {
    mockPageGet.mockResolvedValueOnce({
      id: '31',
      familyName: 'Portal (Customer logged in)',
      pageArea: { id: '4', name: 'Above Content' },
      containers: AREA.containers,
    });
    mockPageGet.mockResolvedValueOnce({ id: '', pageArea: {}, containers: [] });
    mockPageGet.mockRejectedValueOnce(timedOut());

    for (let i = 0; i < 3; i++) {
      expect(
        await readPreviewPageDraft(event(), 'entry-jwt', '/se/sv/'),
      ).toBeNull();
    }
  });
});

describe('caches hang on the preview token', () => {
  describe('menuCache', () => {
    it('is not read with a preview token', async () => {
      const args = { menuLocationId: unique('m') };
      await getMenu(args, event());
      await getMenu(args, tokenOnly());

      expect(mockMenuGet).toHaveBeenCalledTimes(2);
    });

    it('is not written with a preview token', async () => {
      const args = { menuLocationId: unique('m') };
      await getMenu(args, tokenOnly());
      await getMenu(args, event());

      expect(mockMenuGet).toHaveBeenCalledTimes(2);
    });

    it('serves preview_mode without a token as an ordinary cached read', async () => {
      const args = { menuLocationId: unique('m') };
      await getMenu(args, event({ preview_mode: 'true' }));
      await getMenu(args, event({ preview_mode: 'true' }));

      expect(mockMenuGet).toHaveBeenCalledTimes(1);
      expect(mockMenuGet.mock.calls[0]![1]).toEqual({ languageId: 'sv-SE' });
    });
  });

  describe('last-good menu copies', () => {
    it('are not served to a preview read that fails', async () => {
      const args = { menuLocationId: unique('m') };
      await getMenu(args, event());
      mockMenuGet.mockRejectedValue(timedOut());

      await expect(getMenu(args, tokenOnly())).rejects.toThrow();
    });

    it('are not kept from a preview read', async () => {
      const args = { menuLocationId: unique('m') };
      await getMenu(args, tokenOnly());
      mockMenuGet.mockRejectedValue(timedOut());

      await expect(getMenu(args, event())).rejects.toThrow();
    });
  });

  describe('areaCache', () => {
    it('is not read with a preview token', async () => {
      const args = { family: 'Start', areaName: unique('a') };
      await getContentArea(args, event());
      await getContentArea(args, tokenOnly());

      expect(mockAreaGet).toHaveBeenCalledTimes(4);
    });

    it('is not written with a preview token', async () => {
      const args = { family: 'Start', areaName: unique('a') };
      await getContentArea(args, tokenOnly());
      await getContentArea(args, event());

      expect(mockAreaGet).toHaveBeenCalledTimes(4);
    });

    it('serves preview_mode without a token as an ordinary cached read', async () => {
      const args = { family: 'Start', areaName: unique('a') };
      await getContentArea(args, event({ preview_mode: 'true' }));
      await getContentArea(args, event({ preview_mode: 'true' }));

      expect(mockAreaGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('last-good area copies', () => {
    it('are not served to a preview read that fails', async () => {
      const args = { family: 'Start', areaName: unique('a') };
      await getContentArea(args, event());
      mockAreaGet.mockRejectedValue(timedOut());

      await expect(getContentArea(args, tokenOnly())).rejects.toThrow();
    });

    it('are not kept from a preview read', async () => {
      const args = { family: 'Start', areaName: unique('a') };
      await getContentArea(args, tokenOnly());
      mockAreaGet.mockRejectedValue(timedOut());

      await expect(getContentArea(args, event())).rejects.toThrow();
    });
  });

  // One cmsPages entry per host, locale and market: a fresh host per test.
  describe('cmsPagesCache', () => {
    it('is not read with a preview token', async () => {
      const host = unique('pages.test');
      await getListedCmsPage({ alias: 'x' }, event({}, host));
      await getListedCmsPage({ alias: 'x' }, tokenOnly(host));

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('is not written with a preview token', async () => {
      const host = unique('pages.test');
      await getListedCmsPage({ alias: 'x' }, tokenOnly(host));
      await getListedCmsPage({ alias: 'x' }, event({}, host));

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('serves preview_mode without a token as an ordinary cached read', async () => {
      const host = unique('pages.test');
      await getListedCmsPage(
        { alias: 'x' },
        event({ preview_mode: 'true' }, host),
      );
      await getListedCmsPage(
        { alias: 'x' },
        event({ preview_mode: 'true' }, host),
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('pageLinkCache', () => {
    it('is not read with a preview token', async () => {
      const tag = unique('t');
      await getPageLinkByTag({ tag }, event());
      await getPageLinkByTag({ tag }, tokenOnly());

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('is not written with a preview token', async () => {
      const tag = unique('t');
      await getPageLinkByTag({ tag }, tokenOnly());
      await getPageLinkByTag({ tag }, event());

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('serves preview_mode without a token as an ordinary cached read', async () => {
      const tag = unique('t');
      await getPageLinkByTag({ tag }, event({ preview_mode: 'true' }));
      await getPageLinkByTag({ tag }, event({ preview_mode: 'true' }));

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });
});
