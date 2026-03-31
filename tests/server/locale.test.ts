import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock Nitro auto-imports
const mockGetCookie = vi.fn();
vi.stubGlobal('getCookie', mockGetCookie);
vi.stubGlobal('getQuery', () => ({}));

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
        ? { config: { geinsSettings: options.tenantConfig } }
        : undefined,
      resolvedLocaleMarket: options?.resolvedLocaleMarket,
    },
  } as unknown as H3Event;
}

describe('server/utils/locale', () => {
  let getRequestLocale: typeof import('../../server/utils/locale').getRequestLocale;
  let getRequestMarket: typeof import('../../server/utils/locale').getRequestMarket;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('../../server/utils/locale');
    getRequestLocale = mod.getRequestLocale;
    getRequestMarket = mod.getRequestMarket;
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
        tenantConfig: { availableLocales: ['sv-SE', 'en-US'] },
      });
      mockGetCookie.mockReturnValue('sv');

      expect(getRequestLocale(event)).toBe('sv-SE');
      expect(mockGetCookie).toHaveBeenCalledWith(event, 'locale');
    });

    it('should expand short locale to BCP-47 using tenant config', () => {
      const event = createEvent({
        tenantConfig: { availableLocales: ['sv-SE', 'en-US'] },
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

    it('should return undefined for short locale without tenant config', () => {
      const event = createEvent();
      mockGetCookie.mockReturnValue('sv');

      expect(getRequestLocale(event)).toBeUndefined();
    });

    it('should return undefined when cookie is not set', () => {
      const event = createEvent();
      mockGetCookie.mockReturnValue(undefined);

      expect(getRequestLocale(event)).toBeUndefined();
    });

    it('should return undefined when cookie is empty string', () => {
      const event = createEvent();
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
