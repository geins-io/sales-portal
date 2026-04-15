import { describe, it, expect } from 'vitest';
import {
  isSessionExpiredError,
  buildLoginRedirect,
} from '../../app/plugins/auth-redirect.client';

describe('auth-redirect plugin', () => {
  describe('isSessionExpiredError', () => {
    it('returns true for 401 + SESSION_EXPIRED code', () => {
      expect(
        isSessionExpiredError({
          response: {
            status: 401,
            _data: { data: { code: 'SESSION_EXPIRED' } },
          },
        }),
      ).toBe(true);
    });

    it('returns false for 401 WITHOUT the code', () => {
      expect(
        isSessionExpiredError({
          response: { status: 401, _data: { data: { code: 'UNAUTHORIZED' } } },
        }),
      ).toBe(false);
    });

    it('returns false for 401 with no data payload at all', () => {
      expect(
        isSessionExpiredError({
          response: { status: 401, _data: null },
        }),
      ).toBe(false);
    });

    it('returns false for non-401 statuses even if the code is present', () => {
      expect(
        isSessionExpiredError({
          response: {
            status: 500,
            _data: { data: { code: 'SESSION_EXPIRED' } },
          },
        }),
      ).toBe(false);
      expect(
        isSessionExpiredError({
          response: {
            status: 403,
            _data: { data: { code: 'SESSION_EXPIRED' } },
          },
        }),
      ).toBe(false);
    });

    it('returns false for non-object input', () => {
      expect(isSessionExpiredError(null)).toBe(false);
      expect(isSessionExpiredError(undefined)).toBe(false);
      expect(isSessionExpiredError('error')).toBe(false);
      expect(isSessionExpiredError(42)).toBe(false);
    });

    it('returns false when there is no response at all (network error)', () => {
      expect(isSessionExpiredError({})).toBe(false);
      expect(isSessionExpiredError({ response: undefined })).toBe(false);
    });
  });

  describe('buildLoginRedirect', () => {
    it('builds a redirect URL with encoded currentPath', () => {
      expect(
        buildLoginRedirect({
          loginPath: '/se/sv/login',
          currentPath: '/se/sv/portal/quotations',
        }),
      ).toBe('/se/sv/login?redirect=%2Fse%2Fsv%2Fportal%2Fquotations');
    });

    it('preserves query strings inside the redirect target', () => {
      expect(
        buildLoginRedirect({
          loginPath: '/se/sv/login',
          currentPath: '/se/sv/portal/orders?page=2',
        }),
      ).toBe('/se/sv/login?redirect=%2Fse%2Fsv%2Fportal%2Forders%3Fpage%3D2');
    });

    it('returns null when already on a login page (avoids loops)', () => {
      expect(
        buildLoginRedirect({
          loginPath: '/se/sv/login',
          currentPath: '/se/sv/login',
        }),
      ).toBeNull();
      expect(
        buildLoginRedirect({
          loginPath: '/se/sv/login',
          currentPath: '/se/sv/login?redirect=%2Fse%2Fsv%2Fportal',
        }),
      ).toBeNull();
    });

    it('drops unsafe redirect targets (protocol-relative) and navigates to bare login', () => {
      expect(
        buildLoginRedirect({
          loginPath: '/se/sv/login',
          currentPath: '//evil.com/steal',
        }),
      ).toBe('/se/sv/login');
    });

    it('drops unsafe redirect targets (absolute URL)', () => {
      expect(
        buildLoginRedirect({
          loginPath: '/se/sv/login',
          currentPath: 'https://evil.com/steal',
        }),
      ).toBe('/se/sv/login');
    });

    it('drops empty currentPath and navigates to bare login', () => {
      expect(
        buildLoginRedirect({
          loginPath: '/se/sv/login',
          currentPath: '',
        }),
      ).toBe('/se/sv/login');
    });

    it('builds a redirect for paths that merely contain the substring "login"', () => {
      const result = buildLoginRedirect({
        loginPath: '/se/sv/login',
        currentPath: '/se/sv/login-as-user',
      });
      expect(result).toBe(
        '/se/sv/login?redirect=' + encodeURIComponent('/se/sv/login-as-user'),
      );
    });

    it('builds a redirect for /checkout/login-return (no exact login segment)', () => {
      const result = buildLoginRedirect({
        loginPath: '/se/sv/login',
        currentPath: '/se/sv/checkout/login-return',
      });
      expect(result).toBe(
        '/se/sv/login?redirect=' +
          encodeURIComponent('/se/sv/checkout/login-return'),
      );
    });

    it('skips redirect when the path has an exact /login segment', () => {
      expect(
        buildLoginRedirect({
          loginPath: '/se/sv/login',
          currentPath: '/se/sv/login',
        }),
      ).toBeNull();
    });

    it('skips redirect when the path has a /login segment with trailing query', () => {
      expect(
        buildLoginRedirect({
          loginPath: '/se/sv/login',
          currentPath: '/se/sv/login?redirect=/foo',
        }),
      ).toBeNull();
    });
  });
});
