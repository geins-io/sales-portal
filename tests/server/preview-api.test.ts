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

// Stub Nitro auto-imports shared by both endpoints
const setCookieMock = vi.fn();
const deleteCookieMock = vi.fn();
const getCookieMock = vi.fn();
const readBodyMock = vi.fn();

vi.stubGlobal('setCookie', setCookieMock);
vi.stubGlobal('getCookie', getCookieMock);
vi.stubGlobal('deleteCookie', deleteCookieMock);
vi.stubGlobal('readBody', readBodyMock);
// readValidatedBody calls readBody then validates with the provided parser.
// Mirrors H3 behavior: validation errors become 422 responses.
vi.stubGlobal(
  'readValidatedBody',
  async (_event: unknown, parser: (data: unknown) => unknown) => {
    const body = await readBodyMock(_event);
    try {
      return parser(body);
    } catch (err) {
      const error = new Error(
        err instanceof Error ? err.message : 'Validation failed',
      );
      Object.assign(error, { statusCode: 422, data: err });
      throw error;
    }
  },
);

vi.stubGlobal('createAppError', (code: string, message: string) => {
  const err = new Error(message);
  Object.assign(err, {
    statusCode: code === 'VALIDATION_ERROR' ? 422 : 500,
    data: { code },
  });
  return err;
});
vi.stubGlobal('ErrorCode', { VALIDATION_ERROR: 'VALIDATION_ERROR' });

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
vi.stubGlobal('defineEventHandler', (fn: Function) => fn);

// Wire up cookie helpers (they depend on stubbed setCookie/deleteCookie)
const cookies = await import('../../server/utils/cookies');
vi.stubGlobal('clearAuthCookies', cookies.clearAuthCookies);
vi.stubGlobal('setPreviewAuthToken', cookies.setPreviewAuthToken);
vi.stubGlobal('setPreviewCookie', cookies.setPreviewCookie);
vi.stubGlobal('clearPreviewSession', cookies.clearPreviewSession);

// Import handlers (defineEventHandler stub unwraps them to plain functions)
const { default: previewHandler } =
  await import('../../server/api/auth/preview.post');
const { default: previewExitHandler } =
  await import('../../server/api/auth/preview-exit.post');

const mockEvent = {} as H3Event;

describe('POST /api/auth/preview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns success and sets cookies for valid token', async () => {
    readBodyMock.mockResolvedValue({ loginToken: 'jwt-abc' });

    const result = await previewHandler(mockEvent);

    expect(result).toEqual({ success: true });
    expect(setCookieMock).toHaveBeenCalledWith(
      mockEvent,
      'auth_token',
      'jwt-abc',
      expect.objectContaining({ httpOnly: true, maxAge: 3600 }),
    );
    expect(setCookieMock).toHaveBeenCalledWith(
      mockEvent,
      'preview_mode',
      'true',
      expect.objectContaining({ httpOnly: false }),
    );
  });

  it('clears existing auth session before setting preview', async () => {
    readBodyMock.mockResolvedValue({ loginToken: 'jwt-abc' });
    await previewHandler(mockEvent);

    expect(deleteCookieMock).toHaveBeenCalledWith(
      mockEvent,
      'auth_token',
      expect.objectContaining({ path: '/' }),
    );
  });

  it('rejects missing token with 422', async () => {
    readBodyMock.mockResolvedValue({});
    await expect(previewHandler(mockEvent)).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('rejects empty string token with 422', async () => {
    readBodyMock.mockResolvedValue({ loginToken: '' });
    await expect(previewHandler(mockEvent)).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('rejects null body with 422', async () => {
    readBodyMock.mockResolvedValue(null);
    await expect(previewHandler(mockEvent)).rejects.toMatchObject({
      statusCode: 422,
    });
  });
});

describe('POST /api/auth/preview-exit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears all session cookies and returns success', async () => {
    const result = await previewExitHandler(mockEvent);

    expect(result).toEqual({ success: true });
    expect(deleteCookieMock).toHaveBeenCalledTimes(3); // auth_token + refresh_token + preview_mode
  });
});
