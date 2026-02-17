import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock Nitro auto-imports
const mockGetCookie = vi.fn();
vi.stubGlobal('getCookie', mockGetCookie);

// Mock the constants import
vi.mock('#shared/constants/storage', () => ({
  COOKIE_NAMES: {
    LOCALE: 'locale',
    MARKET: 'market',
  },
}));

function createEvent(): H3Event {
  return {} as unknown as H3Event;
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
    it('should return locale from locale cookie', () => {
      const event = createEvent();
      mockGetCookie.mockReturnValue('sv');

      expect(getRequestLocale(event)).toBe('sv');
      expect(mockGetCookie).toHaveBeenCalledWith(event, 'locale');
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
    it('should return market from market cookie', () => {
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
