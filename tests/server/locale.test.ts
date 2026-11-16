import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock Nitro auto-imports
const mockGetCookie = vi.fn();
vi.stubGlobal('getCookie', mockGetCookie);
const mockGetQuery = vi.fn((_event: unknown): Record<string, unknown> => ({}));
vi.stubGlobal('getQuery', mockGetQuery);

// Mock the constants import
vi.mock('#shared/constants/storage', () => ({
  COOKIE_NAMES: {
    LOCALE: 'locale',
    MARKET: 'market',
  },
}));

interface CreateEventOptions {
  tenantConfig?: Record<string, unknown>;
  resolvedLocaleMarket?: {
    market: string;
    locale: string;
    localeBcp47: string;
  };
}

function createEvent(options?: CreateEventOptions): H3Event {
  return {
    context: {
      tenant: options?.tenantConfig
        ? { config: { channelSettings: options.tenantConfig } }
        : undefined,
      resolvedLocaleMarket: options?.resolvedLocaleMarket,
    },
  } as unknown as H3Event;
}

describe('server/utils/locale', () => {
  let getRequestLocale: typeof import('../../server/utils/locale').getRequestLocale;
  let getRequestMarket: typeof import('../../server/utils/locale').getRequestMarket;
  let getRequestedLocale: typeof import('../../server/utils/locale').getRequestedLocale;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('../../server/utils/locale');
    getRequestLocale = mod.getRequestLocale;
    getRequestMarket = mod.getRequestMarket;
    getRequestedLocale = mod.getRequestedLocale;
    mockGetQuery.mockReturnValue({});
  });

  // An API request carries the language of the page that made it as
  // ?locale=. It is checked against the tenant's locales before it wins over
  // the cookie. The market is read as before: the query, else the cookie.
  describe('the locale the calling page sends', () => {
    const lists = {
      locales: ['sv-SE', 'en-GB', 'nb-NO'],
      markets: ['se', 'no'],
      defaultLocale: 'sv-SE',
      defaultMarket: 'se',
    };

    it('wins over the cookie when the tenant serves it', () => {
      const event = createEvent({ tenantConfig: lists });
      mockGetQuery.mockReturnValue({ locale: 'en' });
      mockGetCookie.mockReturnValue('sv');

      expect(getRequestLocale(event)).toBe('en-GB');
    });

    it('accepts a full locale the tenant lists', () => {
      const event = createEvent({ tenantConfig: lists });
      mockGetQuery.mockReturnValue({ locale: 'nb-NO' });

      expect(getRequestLocale(event)).toBe('nb-NO');
    });

    it.each([
      ['a locale the tenant does not serve', 'de'],
      ['a full locale the tenant does not list', 'de-DE'],
      ['a malformed value', 'english'],
      ['a repeated parameter', ['en', 'nb']],
    ])('is ignored for %s, and the cookie decides', (_case, locale) => {
      const event = createEvent({ tenantConfig: lists });
      mockGetQuery.mockReturnValue({ locale });
      mockGetCookie.mockReturnValue('sv');

      expect(getRequestLocale(event)).toBe('sv-SE');
    });

    it('is checked for shape only when the tenant has no lists', () => {
      const event = createEvent({ tenantConfig: { defaultLocale: 'sv-SE' } });
      mockGetCookie.mockReturnValue('sv');

      for (const [locale, expected] of [
        ['en', 'en'],
        ['en-GB', 'en-GB'],
        ['english', 'sv'],
        ['en-GBX', 'sv'],
        ['xen-GB', 'sv'],
      ] as const) {
        mockGetQuery.mockReturnValue({ locale });
        expect(getRequestLocale(event), locale).toBe(expected);
      }
    });

    it('leaves the market as it was read before: the query, else the cookie, else the tenant default', () => {
      const event = createEvent({ tenantConfig: lists });
      mockGetCookie.mockReturnValue('se');

      mockGetQuery.mockReturnValue({ locale: 'en', market: 'no' });
      expect(getRequestMarket(event)).toBe('no');

      mockGetQuery.mockReturnValue({ locale: 'en' });
      expect(getRequestMarket(event)).toBe('se');

      mockGetCookie.mockReturnValue(undefined);
      expect(getRequestMarket(event)).toBe('se');
    });

    it('does not reach the page request itself, which the URL decides', () => {
      const event = createEvent({
        tenantConfig: lists,
        resolvedLocaleMarket: {
          market: 'se',
          locale: 'sv',
          localeBcp47: 'sv-SE',
        },
      });
      mockGetQuery.mockReturnValue({ locale: 'en', market: 'no' });

      expect(getRequestLocale(event)).toBe('sv-SE');
      expect(getRequestMarket(event)).toBe('se');
    });
  });

  // The two-letter locale of the page that made the request, for building a
  // URL prefix: the checked query locale, else the cookie, else nothing.
  describe('getRequestedLocale', () => {
    const lists = { locales: ['sv-SE', 'en-GB'], markets: ['se'] };

    it('answers the locale the calling page sends, over the cookie', () => {
      const event = createEvent({ tenantConfig: lists });
      mockGetQuery.mockReturnValue({ locale: 'en' });
      mockGetCookie.mockReturnValue('sv');

      expect(getRequestedLocale(event)).toBe('en');
    });

    it('answers the short code of a full locale', () => {
      const event = createEvent({ tenantConfig: lists });
      mockGetQuery.mockReturnValue({ locale: 'en-GB' });

      expect(getRequestedLocale(event)).toBe('en');
    });

    it('falls back to a two-letter cookie when the page sends none it serves', () => {
      const event = createEvent({ tenantConfig: lists });
      mockGetCookie.mockReturnValue('sv');

      expect(getRequestedLocale(event)).toBe('sv');
      mockGetQuery.mockReturnValue({ locale: 'de' });
      expect(getRequestedLocale(event)).toBe('sv');
    });

    it('answers nothing for a cookie that is not two letters', () => {
      const event = createEvent({ tenantConfig: lists });
      mockGetCookie.mockReturnValue('sv-SE');

      expect(getRequestedLocale(event)).toBeUndefined();
    });
  });

  describe('getRequestLocale', () => {
    it('should return localeBcp47 from resolvedLocaleMarket when present', () => {
      const event = createEvent({
        resolvedLocaleMarket: {
          market: 'se',
          locale: 'sv',
          localeBcp47: 'sv-SE',
        },
      });
      mockGetCookie.mockReturnValue('en');

      expect(getRequestLocale(event)).toBe('sv-SE');
      expect(mockGetCookie).not.toHaveBeenCalled();
    });

    it('should fall back to cookie when resolvedLocaleMarket is absent', () => {
      const event = createEvent({
        tenantConfig: { locales: ['sv-SE', 'en-US'] },
      });
      mockGetCookie.mockReturnValue('sv');

      expect(getRequestLocale(event)).toBe('sv-SE');
      expect(mockGetCookie).toHaveBeenCalledWith(event, 'locale');
    });

    it('should expand short locale to BCP-47 using tenant config', () => {
      const event = createEvent({
        tenantConfig: { locales: ['sv-SE', 'en-US'] },
      });
      mockGetCookie.mockReturnValue('sv');

      expect(getRequestLocale(event)).toBe('sv-SE');
      expect(mockGetCookie).toHaveBeenCalledWith(event, 'locale');
    });

    it('should return BCP-47 locale as-is', () => {
      const event = createEvent();
      mockGetCookie.mockReturnValue('sv-SE');

      expect(getRequestLocale(event)).toBe('sv-SE');
    });

    it('should return short locale as-is when tenant config unavailable', () => {
      const event = createEvent();
      mockGetCookie.mockReturnValue('sv');

      // Short codes are returned as-is when expansion isn't possible
      expect(getRequestLocale(event)).toBe('sv');
    });

    it('should fall back to the tenant config default locale when cookie is not set', () => {
      const event = createEvent({
        tenantConfig: {
          defaultLocale: 'nb-NO',
          locales: ['nb-NO', 'sv-SE'],
        },
      });
      mockGetCookie.mockReturnValue(undefined);

      expect(getRequestLocale(event)).toBe('nb-NO');
    });

    it('should return undefined when cookie is not set and config has no default', () => {
      const event = createEvent();
      mockGetCookie.mockReturnValue(undefined);

      expect(getRequestLocale(event)).toBeUndefined();
    });

    it('should return undefined when cookie is empty string and config has no default', () => {
      // A locale list is not a default, so it must not stand in for one.
      const event = createEvent({
        tenantConfig: { locales: ['nb-NO'] },
      });
      mockGetCookie.mockReturnValue('');

      expect(getRequestLocale(event)).toBeUndefined();
    });
  });

  describe('getRequestMarket', () => {
    it('should return market from resolvedLocaleMarket when present', () => {
      const event = createEvent({
        resolvedLocaleMarket: {
          market: 'se',
          locale: 'sv',
          localeBcp47: 'sv-SE',
        },
      });
      mockGetCookie.mockReturnValue('no');

      expect(getRequestMarket(event)).toBe('se');
      expect(mockGetCookie).not.toHaveBeenCalled();
    });

    it('should fall back to cookie when resolvedLocaleMarket is absent', () => {
      const event = createEvent();
      mockGetCookie.mockReturnValue('no');

      expect(getRequestMarket(event)).toBe('no');
      expect(mockGetCookie).toHaveBeenCalledWith(event, 'market');
    });

    it('should return undefined when cookie is not set', () => {
      const event = createEvent();
      mockGetCookie.mockReturnValue(undefined);

      expect(getRequestMarket(event)).toBeUndefined();
    });

    it('should return undefined when cookie is empty string', () => {
      const event = createEvent();
      mockGetCookie.mockReturnValue('');

      expect(getRequestMarket(event)).toBeUndefined();
    });
  });
});
