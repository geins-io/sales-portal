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
    it('clears both auth cookies and preview cookie', () => {
      clearPreviewSession(mockEvent);

      expect(deleteCookieMock).toHaveBeenCalledWith(mockEvent, 'auth_token', {
        path: '/',
      });
      expect(deleteCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'refresh_token',
        { path: '/' },
      );
      expect(deleteCookieMock).toHaveBeenCalledWith(mockEvent, 'preview_mode', {
        path: '/',
      });
    });
  });
});
