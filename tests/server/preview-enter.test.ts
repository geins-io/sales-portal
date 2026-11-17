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
// Keeps the path unless a test says otherwise; its own tests live beside it.
const previewLandingPathMock = vi.fn(
  async (_event: unknown, _token: string, path: string) => path,
);
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
vi.stubGlobal('setPreviewToken', cookieUtils.setPreviewToken);
vi.stubGlobal('setPreviewCookie', cookieUtils.setPreviewCookie);

const mockEvent = {} as H3Event;

async function importHandler() {
  vi.resetModules();
  vi.stubGlobal('setCookie', setCookieMock);
  vi.stubGlobal('deleteCookie', deleteCookieMock);
  vi.stubGlobal('getQuery', getQueryMock);
  vi.stubGlobal('sendRedirect', sendRedirectMock);
  vi.stubGlobal('previewLandingPath', previewLandingPathMock);
  vi.stubGlobal('createAppError', createAppErrorMock);
  vi.stubGlobal('ErrorCode', { BAD_REQUEST: 'BAD_REQUEST' });
  vi.stubGlobal(
    'defineEventHandler',
    (fn: (...args: unknown[]) => unknown) => fn,
  );

  const fresh = await import('../../server/utils/cookies');
  vi.stubGlobal('setPreviewToken', fresh.setPreviewToken);
  vi.stubGlobal('setPreviewCookie', fresh.setPreviewCookie);

  const mod = await import('../../server/api/auth/preview-enter.get');
  return mod.default;
}

describe('preview-enter endpoint', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws BAD_REQUEST when loginToken is missing', async () => {
    getQueryMock.mockReturnValue({});
    const handler = await importHandler();
    await expect(handler(mockEvent)).rejects.toThrow('Missing loginToken');
  });

  it('sets the preview token and the preview flag, and deletes nothing', async () => {
    getQueryMock.mockReturnValue({ loginToken: 'some-token' });
    const handler = await importHandler();
    await handler(mockEvent);

    expect(setCookieMock).toHaveBeenCalledWith(
      mockEvent,
      'cms_preview_token',
      'some-token',
      expect.objectContaining({ httpOnly: true, maxAge: 3600 }),
    );
    expect(setCookieMock).toHaveBeenCalledWith(
      mockEvent,
      'preview_mode',
      'true',
      expect.anything(),
    );
    expect(setCookieMock).toHaveBeenCalledTimes(2);
    expect(deleteCookieMock).not.toHaveBeenCalled();
  });

  it('redirects to / by default', async () => {
    getQueryMock.mockReturnValue({ loginToken: 'some-token' });
    const handler = await importHandler();
    await handler(mockEvent);
    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/', 302);
  });

  it('redirects to a valid internal path from ?redirect=', async () => {
    getQueryMock.mockReturnValue({
      loginToken: 'some-token',
      redirect: '/se/sv/',
    });
    const handler = await importHandler();
    await handler(mockEvent);
    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/se/sv/', 302);
  });

  it('prevents open redirect for an absolute URL', async () => {
    getQueryMock.mockReturnValue({
      loginToken: 'some-token',
      redirect: 'https://evil.com',
    });
    const handler = await importHandler();
    await handler(mockEvent);
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
    await handler(mockEvent);
    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/', 302);
  });

  it('prevents open redirect for a backslash-prefixed URL', async () => {
    getQueryMock.mockReturnValue({
      loginToken: 'some-token',
      redirect: '/\\evil.com',
    });
    const handler = await importHandler();
    await handler(mockEvent);
    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, '/', 302);
  });

  it('redirects to where the preview lands, from the token and the safe path', async () => {
    previewLandingPathMock.mockResolvedValueOnce('/se/sv/test-page-draft');
    getQueryMock.mockReturnValue({
      loginToken: 'some-token',
      redirect: '/se/sv/',
    });
    const handler = await importHandler();
    await handler(mockEvent);

    expect(previewLandingPathMock).toHaveBeenCalledWith(
      mockEvent,
      'some-token',
      '/se/sv/',
    );
    expect(sendRedirectMock).toHaveBeenCalledWith(
      mockEvent,
      '/se/sv/test-page-draft',
      302,
    );
  });

  it('never hands an unsafe redirect to the landing', async () => {
    getQueryMock.mockReturnValue({
      loginToken: 'some-token',
      redirect: '//evil.com',
    });
    const handler = await importHandler();
    await handler(mockEvent);

    expect(previewLandingPathMock).toHaveBeenCalledWith(
      mockEvent,
      'some-token',
      '/',
    );
  });
});
