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
const getQueryMock = vi.fn();
const sendRedirectMock = vi.fn();
const createAppErrorMock = vi.fn((code: string, message: string) => {
  const err = new Error(message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (err as any).statusCode = code === 'BAD_REQUEST' ? 400 : 500;
  return err;
});

vi.stubGlobal('setCookie', setCookieMock);
vi.stubGlobal('getCookie', getCookieMock);
vi.stubGlobal('deleteCookie', deleteCookieMock);
vi.stubGlobal('getQuery', getQueryMock);
vi.stubGlobal('sendRedirect', sendRedirectMock);
vi.stubGlobal('createAppError', createAppErrorMock);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
});
vi.stubGlobal(
  'defineEventHandler',
  (fn: (...args: unknown[]) => unknown) => fn,
);

const cookieUtils = await import('../../server/utils/cookies');
const { setSpoofedByCookie, getSpoofedByCookie, clearSpoofedByCookie } =
  cookieUtils;

// Stub Nuxt auto-imports used by the endpoint
vi.stubGlobal('setPreviewAuthToken', cookieUtils.setPreviewAuthToken);
vi.stubGlobal('setSpoofedByCookie', cookieUtils.setSpoofedByCookie);

const mockEvent = {} as H3Event;

/**
 * Re-stub all globals after vi.resetModules() and re-import the endpoint.
 * Returns the handler function.
 */
async function importHandler() {
  vi.resetModules();
  vi.stubGlobal('setCookie', setCookieMock);
  vi.stubGlobal('getCookie', getCookieMock);
  vi.stubGlobal('deleteCookie', deleteCookieMock);
  vi.stubGlobal('getQuery', getQueryMock);
  vi.stubGlobal('sendRedirect', sendRedirectMock);
  vi.stubGlobal('createAppError', createAppErrorMock);
  vi.stubGlobal('ErrorCode', {
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
  });
  vi.stubGlobal(
    'defineEventHandler',
    (fn: (...args: unknown[]) => unknown) => fn,
  );

  // Re-import cookies so auto-import stubs point to fresh module using our mocks
  const freshCookies = await import('../../server/utils/cookies');
  vi.stubGlobal('setPreviewAuthToken', freshCookies.setPreviewAuthToken);
  vi.stubGlobal('setSpoofedByCookie', freshCookies.setSpoofedByCookie);

  const mod = await import('../../server/api/auth/login-as.get');
  return mod.default;
}

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe('spoofed-by cookie helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('setSpoofedByCookie', () => {
    it('sets geins-spoofed-by cookie with httpOnly: false', () => {
      setSpoofedByCookie(mockEvent, 'admin@geins.io');

      expect(setCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'geins-spoofed-by',
        'admin@geins.io',
        expect.objectContaining({
          httpOnly: false,
          path: '/',
        }),
      );
    });

    it('sets cookie with 1 hour maxAge', () => {
      setSpoofedByCookie(mockEvent, 'admin@geins.io');

      expect(setCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'geins-spoofed-by',
        'admin@geins.io',
        expect.objectContaining({ maxAge: 3600 }),
      );
    });
  });

  describe('getSpoofedByCookie', () => {
    it('returns the cookie value when set', () => {
      getCookieMock.mockReturnValue('admin@geins.io');
      expect(getSpoofedByCookie(mockEvent)).toBe('admin@geins.io');
    });

    it('returns undefined when cookie is not set', () => {
      getCookieMock.mockReturnValue(undefined);
      expect(getSpoofedByCookie(mockEvent)).toBeUndefined();
    });
  });

  describe('clearSpoofedByCookie', () => {
    it('deletes the geins-spoofed-by cookie', () => {
      clearSpoofedByCookie(mockEvent);

      expect(deleteCookieMock).toHaveBeenCalledWith(
        mockEvent,
        'geins-spoofed-by',
        { path: '/' },
      );
    });
  });
});

describe('login-as endpoint', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws BAD_REQUEST when loginToken is missing', async () => {
    getQueryMock.mockReturnValue({});
    const handler = await importHandler();
    expect(() => handler(mockEvent)).toThrow('Missing loginToken');
  });

  it('throws BAD_REQUEST when loginToken is not a valid JWT format', async () => {
    getQueryMock.mockReturnValue({ loginToken: 'not-a-jwt' });
    const handler = await importHandler();
    expect(() => handler(mockEvent)).toThrow('Invalid loginToken format');
  });

  it('sets auth cookie and spoofed-by cookie for impersonation token', async () => {
    const token = fakeJwt({
      SpoofedBy: 'admin@geins.io',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    getQueryMock.mockReturnValue({ loginToken: token });

    const handler = await importHandler();
    handler(mockEvent);

    // Should set auth_token cookie
    expect(setCookieMock).toHaveBeenCalledWith(
      mockEvent,
      'auth_token',
      token,
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );

    // Should set spoofed-by cookie
    expect(setCookieMock).toHaveBeenCalledWith(
      mockEvent,
      'geins-spoofed-by',
      'admin@geins.io',
      expect.objectContaining({ httpOnly: false, path: '/' }),
    );
  });

  it('sets auth cookie without spoofed-by for regular login token', async () => {
    const token = fakeJwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    getQueryMock.mockReturnValue({ loginToken: token });

    const handler = await importHandler();
    handler(mockEvent);

    // Should set auth_token
    expect(setCookieMock).toHaveBeenCalledWith(
      mockEvent,
      'auth_token',
      token,
      expect.objectContaining({ httpOnly: true }),
    );

    // Should NOT set spoofed-by
    const spoofedCalls = setCookieMock.mock.calls.filter(
      (call: unknown[]) => call[1] === 'geins-spoofed-by',
    );
    expect(spoofedCalls).toHaveLength(0);
  });

  it('redirects to /portal by default', async () => {
    const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    getQueryMock.mockReturnValue({ loginToken: token });

    const handler = await importHandler();
    handler(mockEvent);

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/portal', 302);
  });

  it('redirects to custom path from redirect query param', async () => {
    const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    getQueryMock.mockReturnValue({
      loginToken: token,
      redirect: '/dashboard',
    });

    const handler = await importHandler();
    handler(mockEvent);

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/dashboard', 302);
  });

  it('prevents open redirect by sanitizing redirect param', async () => {
    const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    getQueryMock.mockReturnValue({
      loginToken: token,
      redirect: 'https://evil.com',
    });

    const handler = await importHandler();
    handler(mockEvent);

    // Should fall back to /portal instead of external URL
    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/portal', 302);
  });
});
