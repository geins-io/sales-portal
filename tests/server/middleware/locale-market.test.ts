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

function makeEvent(
  path: string,
  config?: {
    locale?: string;
    market?: string;
    availableLocales?: string[];
    availableMarkets?: string[];
  },
): H3Event {
  return {
    path,
    context: config
      ? { tenant: { config: { geinsSettings: { ...config } } } }
      : {},
  } as unknown as H3Event;
}

/**
 * Mirrors the dev fixture. Invalid codes in these cases are always 'xx'/'zz',
 * which no registry will ever assign — a real code like 'de' would quietly stop
 * meaning "invalid" the day a tenant or this build starts shipping it.
 */
const VALIDATING_TENANT = {
  locale: 'sv-SE',
  market: 'se',
  availableLocales: ['sv-SE', 'en-GB', 'nb-NO', 'fi-FI', 'da-DK'],
  availableMarkets: ['se', 'fi'],
};

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

  it('redirects the cookieless root to the tenant config default locale when present', () => {
    handler(makeEvent('/', { locale: 'nb-NO' }));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/nb/',
      302,
    );
  });

  it('redirects the cookieless root to "sv" when the tenant config has no default locale', () => {
    handler(makeEvent('/'));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/',
      302,
    );
  });

  it('prefers the locale cookie over the tenant config default', () => {
    getCookieMock.mockImplementation((_e: unknown, name: string) =>
      name === 'locale' ? 'en' : undefined,
    );
    handler(makeEvent('/', { locale: 'nb-NO' }));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/en/',
      302,
    );
  });

  it('redirects the cookieless root to the tenant config default market when present', () => {
    handler(makeEvent('/', { market: 'dk', locale: 'nb-NO' }));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/dk/nb/',
      302,
    );
  });

  it('redirects the cookieless root to "se" when the tenant config has no default market', () => {
    handler(makeEvent('/', { locale: 'nb-NO' }));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/nb/',
      302,
    );
  });

  it('prefers the market cookie over the tenant config default market', () => {
    getCookieMock.mockImplementation((_e: unknown, name: string) =>
      name === 'market' ? 'no' : undefined,
    );
    handler(makeEvent('/', { market: 'dk', locale: 'nb-NO' }));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/no/nb/',
      302,
    );
  });

  it('applies the tenant default market to a prefix-less type route', () => {
    handler(makeEvent('/p/kategori-1/skarkant', { market: 'dk' }));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/dk/sv/p/kategori-1/skarkant',
      301,
    );
  });

  it('301-redirects a product URL with no /market/locale/ prefix to the tenant default locale URL', () => {
    handler(makeEvent('/p/kategori-1/skarkant', { locale: 'nb-NO' }));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/nb/p/kategori-1/skarkant',
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

  it('302-redirects a prefix-less type route when cookies decide the target', () => {
    getCookieMock.mockImplementation((_e, name) =>
      name === 'market' ? 'no' : name === 'locale' ? 'en' : undefined,
    );
    handler(makeEvent('/p/foo/bar'));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/no/en/p/foo/bar',
      302,
    );
  });

  it('302-redirects a prefix-less type route when only one cookie is set', () => {
    getCookieMock.mockImplementation((_e, name) =>
      name === 'locale' ? 'en' : undefined,
    );
    handler(makeEvent('/p/foo/bar'));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/en/p/foo/bar',
      302,
    );
  });

  it('does not redirect URLs that are neither root nor type-prefixed', () => {
    handler(makeEvent('/about-us'));
    expect(sendRedirectMock).not.toHaveBeenCalled();
  });
});

/** Drives the real handler with a tenant on the context, not just the pure function. */
describe('00.locale-market URL validation against the tenant', () => {
  it('redirects a locale the tenant does not carry, without setting cookies', () => {
    handler(makeEvent('/se/xx', VALIDATING_TENANT));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/',
      302,
    );
    expect(setCookieMock).not.toHaveBeenCalled();
  });

  it('redirects a market the tenant does not carry, without setting cookies', () => {
    handler(makeEvent('/xx/sv', VALIDATING_TENANT));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/',
      302,
    );
    expect(setCookieMock).not.toHaveBeenCalled();
  });

  it('redirects a locale the tenant carries but the app ships no messages for', () => {
    handler(
      makeEvent('/se/xx', {
        ...VALIDATING_TENANT,
        availableLocales: [...VALIDATING_TENANT.availableLocales, 'xx-XX'],
      }),
    );
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/',
      302,
    );
  });

  it('preserves the remaining path and query on a corrected redirect', () => {
    handler(makeEvent('/se/xx/c/some-cat?page=2', VALIDATING_TENANT));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/c/some-cat?page=2',
      302,
    );
  });

  it('sets both cookies and resolvedLocaleMarket for a valid pair', () => {
    const event = makeEvent('/se/nb/p/foo', VALIDATING_TENANT);
    handler(event);
    expect(sendRedirectMock).not.toHaveBeenCalled();
    expect(setCookieMock).toHaveBeenCalledWith(
      event,
      'market',
      'se',
      expect.any(Object),
    );
    expect(setCookieMock).toHaveBeenCalledWith(
      event,
      'locale',
      'nb',
      expect.any(Object),
    );
    expect(event.context.localeMarket).toEqual({ market: 'se', locale: 'nb' });
    expect(event.context.resolvedLocaleMarket).toEqual({
      market: 'se',
      locale: 'nb',
      localeBcp47: 'nb-NO',
    });
  });

  it('leaves resolvedLocaleMarket unset when the tenant carries no lists to validate against', () => {
    const event = makeEvent('/zz/qq/p/foo', { locale: 'sv-SE', market: 'se' });
    handler(event);
    expect(sendRedirectMock).not.toHaveBeenCalled();
    expect(event.context.localeMarket).toEqual({ market: 'zz', locale: 'qq' });
    expect(event.context.resolvedLocaleMarket).toBeUndefined();
  });

  // Ported from the plugin suite, where these ran against a hand-set
  // event.context.localeMarket that the real request path never produces.
  const TENANT_SE_NO_DK = {
    locale: 'sv-SE',
    market: 'se',
    availableLocales: ['sv-SE', 'en-US'],
    availableMarkets: ['se', 'no', 'dk'],
  };

  it('resolves a valid secondary market and locale to its BCP-47 tag', () => {
    const event = makeEvent('/no/en/products', TENANT_SE_NO_DK);
    handler(event);
    expect(sendRedirectMock).not.toHaveBeenCalled();
    expect(event.context.resolvedLocaleMarket).toEqual({
      market: 'no',
      locale: 'en',
      localeBcp47: 'en-US',
    });
  });

  it('corrects an invalid market but keeps the valid locale', () => {
    handler(makeEvent('/xx/sv/products', TENANT_SE_NO_DK));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/products',
      302,
    );
  });

  it('corrects an invalid locale but keeps the valid market', () => {
    handler(makeEvent('/no/xx/products', TENANT_SE_NO_DK));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/no/sv/products',
      302,
    );
  });

  it('corrects both axes when both are invalid', () => {
    handler(makeEvent('/zz/xx/products', TENANT_SE_NO_DK));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/products',
      302,
    );
  });

  it('preserves the query string on the root redirect', () => {
    handler(makeEvent('/?ref=promo', TENANT_SE_NO_DK));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/?ref=promo',
      302,
    );
  });

  it('expands en to en-US when en-US is listed before en-GB', () => {
    const event = makeEvent('/se/en', {
      ...TENANT_SE_NO_DK,
      availableLocales: ['sv-SE', 'en-US', 'en-GB'],
    });
    handler(event);
    expect(event.context.resolvedLocaleMarket).toMatchObject({
      locale: 'en',
      localeBcp47: 'en-US',
    });
  });

  it('expands en to en-GB when en-GB is listed before en-US', () => {
    const event = makeEvent('/se/en', {
      ...TENANT_SE_NO_DK,
      availableLocales: ['sv-SE', 'en-GB', 'en-US'],
    });
    handler(event);
    expect(event.context.resolvedLocaleMarket).toMatchObject({
      locale: 'en',
      localeBcp47: 'en-GB',
    });
  });

  it('does not redirect a tenant whose own default market fails validation', () => {
    // defaultMarket 'se' is absent from availableMarkets, so the correction
    // would resolve to a URL that corrects to itself.
    handler(
      makeEvent('/se/sv', {
        ...VALIDATING_TENANT,
        availableMarkets: ['fi'],
        market: 'se',
      }),
    );
    expect(sendRedirectMock).not.toHaveBeenCalled();
  });
});

/**
 * The canonicalisation table, in tenant-a terms: defaults se/sv, markets se/fi,
 * locales sv/en/nb/fi/da.
 */
describe('00.locale-market prefix canonicalisation', () => {
  const TENANT = {
    locale: 'sv-SE',
    market: 'se',
    availableLocales: ['sv-SE', 'en-GB', 'nb-NO', 'fi-FI', 'da-DK'],
    availableMarkets: ['se', 'fi'],
  };

  const TABLE: Array<[string, string, string]> = [
    ['/se/xx', '/se/sv/', 'invalid locale -> default locale, market kept'],
    ['/xx/en', '/se/en/', 'invalid market -> default market, locale kept'],
    ['/hejhej/en', '/se/en/', 'broken segment dropped, locale kept'],
    [
      '/hejhej/blaha',
      '/se/sv/hejhej/blaha',
      'nothing matches -> whole string is content',
    ],
    ['/se/xx', '/se/sv/', 'unknown two-letter segment is a locale attempt'],
    ['/se/xx/foo', '/se/sv/foo', 'locale attempt corrected, tail preserved'],
    [
      '/se/xxx',
      '/se/sv/xxx',
      'non-code segment stays content, default locale fills the gap',
    ],
    [
      '/se/xxx/foo',
      '/se/sv/xxx/foo',
      'non-code segment and its tail both stay content',
    ],
  ];

  for (const [request, expected, why] of TABLE) {
    it(`${request} -> ${expected} (${why})`, () => {
      handler(makeEvent(request, TENANT));
      expect(sendRedirectMock).toHaveBeenCalledWith(
        expect.anything(),
        expected,
        302,
      );
    });
  }

  it('writes no cookies on any corrective hop', () => {
    for (const [request] of TABLE) {
      setCookieMock.mockClear();
      handler(makeEvent(request, TENANT));
      expect(setCookieMock, `${request} wrote a cookie`).not.toHaveBeenCalled();
    }
  });

  it('ignores locale/market cookies when correcting a botched prefix', () => {
    // A stale cookie must not decide where a bad URL lands.
    getCookieMock.mockImplementation((_e: unknown, name: string) =>
      name === 'market' ? 'fi' : name === 'locale' ? 'nb' : undefined,
    );
    handler(makeEvent('/se/xx', TENANT));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/',
      302,
    );
  });

  it('preserves the query string through canonicalisation', () => {
    handler(makeEvent('/hejhej/blaha?page=2', TENANT));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/hejhej/blaha?page=2',
      302,
    );
  });

  it('renders a canonical URL in place rather than redirecting', () => {
    const event = makeEvent('/fi/fi/c/cat', TENANT);
    handler(event);
    expect(sendRedirectMock).not.toHaveBeenCalled();
    expect(event.context.resolvedLocaleMarket).toEqual({
      market: 'fi',
      locale: 'fi',
      localeBcp47: 'fi-FI',
    });
  });

  it('sends type-prefixed content paths 301 so search engines collapse them', () => {
    handler(makeEvent('/p/kategori-1/skarkant', TENANT));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/p/kategori-1/skarkant',
      301,
    );
  });

  it('keeps the dc type prefix even though it is two letters', () => {
    // 'dc' must never be read as a market attempt: that would drop the
    // segment and land the campaign link on a 404.
    handler(makeEvent('/dc/campaign', TENANT));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/dc/campaign',
      301,
    );
  });

  it('keeps a type prefix whose alias is a servable locale code', () => {
    // 'c' followed by 'en' must not be read as a botched market + locale.
    handler(makeEvent('/c/en', TENANT));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/c/en',
      301,
    );
  });

  it('301s a cookieless type route to the tenant defaults', () => {
    handler(makeEvent('/p/foo', TENANT));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/sv/p/foo',
      301,
    );
  });

  it('302s a cookied type route to the cookie-derived prefix', () => {
    getCookieMock.mockImplementation((_e: unknown, name: string) =>
      name === 'market' ? 'se' : name === 'locale' ? 'nb' : undefined,
    );
    handler(makeEvent('/p/foo', TENANT));
    expect(sendRedirectMock).toHaveBeenCalledWith(
      expect.anything(),
      '/se/nb/p/foo',
      302,
    );
  });

  // Only pages carry a prefix. These are all reachable at fixed URLs that must
  // not move, and several serve 200 in production today.
  it('leaves non-page runtime routes untouched', () => {
    const NON_PAGES = [
      '/api/products/foo',
      '/_nuxt/entry.js',
      '/__nuxt_error',
      '/robots.txt',
      '/sitemap.xml',
      '/.well-known/security.txt',
      '/_ipx/w_100/img/x.png',
      '/_ipx/w_100/img/x',
      '/favicon.ico',
      '/healthz',
    ];
    for (const p of NON_PAGES) {
      sendRedirectMock.mockClear();
      setCookieMock.mockClear();
      handler(makeEvent(p, TENANT));
      expect(sendRedirectMock, p).not.toHaveBeenCalled();
      expect(setCookieMock, p).not.toHaveBeenCalled();
    }
  });
});
