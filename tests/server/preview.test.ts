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
  setPreviewAuthToken,
  setPreviewCookie,
  getPreviewCookie,
  clearPreviewCookie,
  clearPreviewSession,
} = await import('../../server/utils/cookies');

const mockEvent = {} as H3Event;

describe('preview cookie helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('setPreviewAuthToken', () => {
    it('sets AUTH_TOKEN cookie with default maxAge', () => {
      setPreviewAuthToken(mockEvent, 'jwt-token-123');

      expect(setCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'auth_token',
        'jwt-token-123',
        expect.objectContaining({ httpOnly: true, path: '/', maxAge: 3600 }),
      );
    });

    it('sets AUTH_TOKEN cookie with custom maxAge', () => {
      setPreviewAuthToken(mockEvent, 'jwt-token-123', 1800);

      expect(setCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'auth_token',
        'jwt-token-123',
        expect.objectContaining({ maxAge: 1800 }),
      );
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

  describe('clearPreviewCookie', () => {
    it('deletes the preview_mode cookie', () => {
      clearPreviewCookie(mockEvent);

      expect(deleteCookieMock).toHaveBeenCalledWith(mockEvent, 'preview_mode', {
        path: '/',
      });
    });
  });

  describe('clearPreviewSession', () => {
    it('deletes the preview cookies with their set attributes so partitioned cookies are removed', () => {
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

      expect(deleteCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'auth_token',
        expect.objectContaining(previewAttrs),
      );
      expect(deleteCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'refresh_token',
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
