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

const { getContentArea, getPage, getMenu, getListedCmsPage, getPageLinkByTag } =
  await import('../../../server/services/cms');

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

  it('page: one read with the preview token and no preview key', async () => {
    await getPage({ alias: '/about' }, inPreview({ auth_token: BUYER }));

    expect(mockPageGet).toHaveBeenCalledTimes(1);
    expect(mockPageGet).toHaveBeenCalledWith(
      { alias: '/about', ...channelVars },
      { languageId: 'sv-SE', userToken: PREVIEW },
    );
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
      { menuLocationId, ...withoutLanguage },
      { userToken: PREVIEW },
    );
  });

  it('cmsPages: no user token, preview or not', async () => {
    await getListedCmsPage({ alias: 'x' }, inPreview({ auth_token: BUYER }));

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0]).toHaveLength(1);
  });

  it('pageLink: no user token, preview or not', async () => {
    await getPageLinkByTag(
      { tag: unique('t') },
      inPreview({ auth_token: BUYER }),
    );

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0]).toHaveLength(1);
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
