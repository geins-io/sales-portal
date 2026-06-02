import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

const getCookieMock = vi.fn();
const setCookieMock = vi.fn();
const sendRedirectMock = vi.fn();

vi.stubGlobal('getCookie', getCookieMock);
vi.stubGlobal('setCookie', setCookieMock);
vi.stubGlobal('sendRedirect', sendRedirectMock);
vi.stubGlobal('defineEventHandler', (fn: (e: H3Event) => unknown) => fn);

vi.mock('#shared/constants/storage', () => ({
  COOKIE_NAMES: {
    LOCALE: 'locale',
    MARKET: 'market',
  },
}));

vi.mock('#shared/constants/route-paths', () => ({
  ROUTE_PATHS: {
    category: '/c',
    product: '/p',
    brand: '/b',
    list: '/l',
    search: '/s',
    discountCampaign: '/dc',
  },
}));

function makeEvent(path: string): H3Event {
  return {
    path,
    context: {},
  } as unknown as H3Event;
}

let handler: (event: H3Event) => unknown;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  getCookieMock.mockReturnValue(undefined);
  const mod = await import('../../../server/middleware/00.locale-market');
  handler = mod.default as (event: H3Event) => unknown;
});

describe('00.locale-market middleware', () => {
  it('passes through API routes without touching the event', () => {
    handler(makeEvent('/api/products/foo'));
    expect(sendRedirectMock).not.toHaveBeenCalled();
    expect(setCookieMock).not.toHaveBeenCalled();
  });

  it('writes market/locale cookies and context when the URL is fully prefixed', () => {
    const event = makeEvent('/se/sv/p/foo/bar');
    handler(event);
    expect(setCookieMock).toHaveBeenCalledWith(
      event,
      'market',
      'se',
      expect.any(Object),
    );
    expect(setCookieMock).toHaveBeenCalledWith(
      event,
      'locale',
      'sv',
      expect.any(Object),
    );
    expect(event.context.localeMarket).toEqual({ market: 'se', locale: 'sv' });
    expect(sendRedirectMock).not.toHaveBeenCalled();
  });

  it('redirects the root path to the locale-prefixed root with cookie defaults', () => {
    getCookieMock.mockImplementation((_e, name) =>
      name === 'market' ? 'no' : name === 'locale' ? 'en' : undefined,
    );
    handler(makeEvent('/'));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/no/en/',
      302,
    );
  });

  it('301-redirects a product URL with no /market/locale/ prefix to the canonical locale URL', () => {
    handler(makeEvent('/p/kategori-1/skarkant'));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/p/kategori-1/skarkant',
      301,
    );
  });

  it('301-redirects every type-prefixed segment (c, p, b, l, s, dc) without locale', () => {
    for (const seg of ['c', 'p', 'b', 'l', 's', 'dc']) {
      sendRedirectMock.mockClear();
      handler(makeEvent(`/${seg}/foo`));
      expect(sendRedirectMock).toHaveBeenCalledWith(
        expect.anything(),
        `/se/sv/${seg}/foo`,
        301,
      );
    }
  });

  it('preserves query strings when redirecting a prefix-less type route', () => {
    handler(makeEvent('/c/kategori-1?page=2'));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/c/kategori-1?page=2',
      301,
    );
  });

  it('honors locale/market cookies when redirecting a prefix-less type route', () => {
    getCookieMock.mockImplementation((_e, name) =>
      name === 'market' ? 'no' : name === 'locale' ? 'en' : undefined,
    );
    handler(makeEvent('/p/foo/bar'));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/no/en/p/foo/bar',
      301,
    );
  });

  it('does not redirect URLs that are neither root nor type-prefixed', () => {
    handler(makeEvent('/about-us'));
    expect(sendRedirectMock).not.toHaveBeenCalled();
  });
});
