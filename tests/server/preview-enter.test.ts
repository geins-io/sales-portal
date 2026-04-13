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
vi.stubGlobal('deleteCookie', deleteCookieMock);
vi.stubGlobal('getQuery', getQueryMock);
vi.stubGlobal('sendRedirect', sendRedirectMock);
vi.stubGlobal('createAppError', createAppErrorMock);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
});
vi.stubGlobal(
  'defineEventHandler',
  (fn: (...args: unknown[]) => unknown) => fn,
);

const cookieUtils = await import('../../server/utils/cookies');
vi.stubGlobal('setPreviewAuthToken', cookieUtils.setPreviewAuthToken);
vi.stubGlobal('setPreviewCookie', cookieUtils.setPreviewCookie);
vi.stubGlobal('clearAuthCookies', cookieUtils.clearAuthCookies);

const mockEvent = {} as H3Event;

async function importHandler() {
  vi.resetModules();
  vi.stubGlobal('setCookie', setCookieMock);
  vi.stubGlobal('deleteCookie', deleteCookieMock);
  vi.stubGlobal('getQuery', getQueryMock);
  vi.stubGlobal('sendRedirect', sendRedirectMock);
  vi.stubGlobal('createAppError', createAppErrorMock);
  vi.stubGlobal('ErrorCode', { BAD_REQUEST: 'BAD_REQUEST' });
  vi.stubGlobal(
    'defineEventHandler',
    (fn: (...args: unknown[]) => unknown) => fn,
  );

  const fresh = await import('../../server/utils/cookies');
  vi.stubGlobal('setPreviewAuthToken', fresh.setPreviewAuthToken);
  vi.stubGlobal('setPreviewCookie', fresh.setPreviewCookie);
  vi.stubGlobal('clearAuthCookies', fresh.clearAuthCookies);

  const mod = await import('../../server/api/auth/preview-enter.get');
  return mod.default;
}

describe('preview-enter endpoint', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws BAD_REQUEST when loginToken is missing', async () => {
    getQueryMock.mockReturnValue({});
    const handler = await importHandler();
    expect(() => handler(mockEvent)).toThrow('Missing loginToken');
  });

  it('redirects to / by default', async () => {
    getQueryMock.mockReturnValue({ loginToken: 'some-token' });
    const handler = await importHandler();
    handler(mockEvent);
    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/', 302);
  });

  it('redirects to a valid internal path from ?redirect=', async () => {
    getQueryMock.mockReturnValue({
      loginToken: 'some-token',
      redirect: '/se/sv/',
    });
    const handler = await importHandler();
    handler(mockEvent);
    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/se/sv/', 302);
  });

  it('prevents open redirect for an absolute URL', async () => {
    getQueryMock.mockReturnValue({
      loginToken: 'some-token',
      redirect: 'https://evil.com',
    });
    const handler = await importHandler();
    handler(mockEvent);
    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/', 302);
  });

  it('prevents open redirect for a protocol-relative URL', async () => {
    // Regression: `//evil.com` passed the old `startsWith('/') && !includes('://')`
    // check and the browser resolved it as `http://evil.com/`.
    getQueryMock.mockReturnValue({
      loginToken: 'some-token',
      redirect: '//evil.com',
    });
    const handler = await importHandler();
    handler(mockEvent);
    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/', 302);
  });

  it('prevents open redirect for a backslash-prefixed URL', async () => {
    getQueryMock.mockReturnValue({
      loginToken: 'some-token',
      redirect: '/\\evil.com',
    });
    const handler = await importHandler();
    handler(mockEvent);
    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/', 302);
  });
});
