import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

vi.mock('../../server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const setCookieMock = vi.fn();
const getCookieMock = vi.fn();
const deleteCookieMock = vi.fn();

vi.stubGlobal('setCookie', setCookieMock);
vi.stubGlobal('getCookie', getCookieMock);
vi.stubGlobal('deleteCookie', deleteCookieMock);

const {
  setPreviewToken,
  getPreviewToken,
  setPreviewCookie,
  getPreviewCookie,
  clearPreviewSession,
} = await import('../../server/utils/cookies');

const mockEvent = {} as H3Event;

describe('preview cookie helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('setPreviewToken', () => {
    it('sets its own httpOnly cookie, never auth_token', () => {
      setPreviewToken(mockEvent, 'jwt-token-123');

      expect(setCookieMock).toHaveBeenCalledTimes(1);
      expect(setCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'cms_preview_token',
        'jwt-token-123',
        expect.objectContaining({ httpOnly: true, path: '/', maxAge: 3600 }),
      );
    });
  });

  describe('getPreviewToken', () => {
    it('reads the preview token cookie', () => {
      getCookieMock.mockImplementation((_event: unknown, name: string) =>
        name === 'cms_preview_token' ? 'jwt-token-123' : 'other',
      );
      expect(getPreviewToken(mockEvent)).toBe('jwt-token-123');
    });

    it('answers undefined without one', () => {
      getCookieMock.mockReturnValue(undefined);
      expect(getPreviewToken(mockEvent)).toBeUndefined();
    });

    it('answers undefined for an empty cookie', () => {
      getCookieMock.mockReturnValue('');
      expect(getPreviewToken(mockEvent)).toBeUndefined();
    });
  });

  describe('setPreviewCookie', () => {
    it('sets preview_mode cookie with httpOnly: false', () => {
      setPreviewCookie(mockEvent);

      expect(setCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'preview_mode',
        'true',
        expect.objectContaining({ httpOnly: false, path: '/', maxAge: 3600 }),
      );
    });
  });

  describe('getPreviewCookie', () => {
    it('returns true when cookie value is "true"', () => {
      getCookieMock.mockReturnValue('true');
      expect(getPreviewCookie(mockEvent)).toBe(true);
    });

    it('returns false when cookie is undefined', () => {
      getCookieMock.mockReturnValue(undefined);
      expect(getPreviewCookie(mockEvent)).toBe(false);
    });

    it('returns false when cookie has different value', () => {
      getCookieMock.mockReturnValue('false');
      expect(getPreviewCookie(mockEvent)).toBe(false);
    });
  });

  describe('clearPreviewSession', () => {
    it('deletes only the preview cookies, with their set attributes so partitioned cookies are removed', () => {
      clearPreviewSession(mockEvent);

      // Preview cookies are set Partitioned/SameSite=None/Secure in prod; the
      // delete must repeat those attributes or the partitioned cookie survives.
      const isProd = !import.meta.dev;
      const previewAttrs = {
        sameSite: isProd ? 'none' : 'lax',
        secure: isProd,
        path: '/',
        partitioned: isProd,
      };

      expect(deleteCookieMock).toHaveBeenCalledTimes(2);
      expect(deleteCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'cms_preview_token',
        expect.objectContaining(previewAttrs),
      );
      expect(deleteCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'preview_mode',
        expect.objectContaining(previewAttrs),
      );
    });
  });
});
