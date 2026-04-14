import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Stub Nitro auto-imports that requireAuth depends on.
const getAuthCookiesMock = vi.fn();
const setAuthCookiesMock = vi.fn();
const clearAuthCookiesMock = vi.fn();
const getPreviewCookieMock = vi.fn().mockReturnValue(false);

vi.stubGlobal('getAuthCookies', getAuthCookiesMock);
vi.stubGlobal('setAuthCookies', setAuthCookiesMock);
vi.stubGlobal('clearAuthCookies', clearAuthCookiesMock);
vi.stubGlobal('getPreviewCookie', getPreviewCookieMock);

// Use the REAL createAppError / ErrorCode so we verify the shape of the
// thrown H3Error — including the statusCode and data.code — matches what
// the client-side interceptor expects.
const errorsModule = await import('../../server/utils/errors');
vi.stubGlobal('createAppError', errorsModule.createAppError);
vi.stubGlobal('ErrorCode', errorsModule.ErrorCode);

// Mock the SDK-facing auth service so we can drive refresh outcomes.
const refreshMock = vi.fn();
vi.mock('../../server/services/auth', () => ({
  refresh: (...args: unknown[]) => refreshMock(...args),
}));

const { requireAuth, optionalAuth } = await import('../../server/utils/auth');

const mockEvent = {} as H3Event;

interface ThrownError {
  statusCode: number;
  data?: { code?: string };
}

describe('requireAuth session refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tokens when both cookies are present without calling refresh', async () => {
    getAuthCookiesMock.mockReturnValue({
      authToken: 'at',
      refreshToken: 'rt',
    });

    const tokens = await requireAuth(mockEvent);

    expect(tokens).toEqual({ authToken: 'at', refreshToken: 'rt' });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('throws SESSION_EXPIRED with statusCode 401 when the refresh service rejects', async () => {
    getAuthCookiesMock.mockReturnValue({
      authToken: '',
      refreshToken: 'rt-expired',
    });
    refreshMock.mockRejectedValue(new Error('refresh token invalid'));

    await expect(requireAuth(mockEvent)).rejects.toMatchObject({
      statusCode: 401,
      data: { code: 'SESSION_EXPIRED' },
    });
    expect(clearAuthCookiesMock).toHaveBeenCalledWith(mockEvent);
  });

  it('throws SESSION_EXPIRED when refresh succeeds but returns an unsuccessful result', async () => {
    getAuthCookiesMock.mockReturnValue({
      authToken: '',
      refreshToken: 'rt',
    });
    refreshMock.mockResolvedValue({ succeeded: false });

    let thrown: ThrownError | undefined;
    try {
      await requireAuth(mockEvent);
    } catch (e) {
      thrown = e as ThrownError;
    }

    expect(thrown).toBeDefined();
    expect(thrown?.statusCode).toBe(401);
    expect(thrown?.data?.code).toBe('SESSION_EXPIRED');
    expect(clearAuthCookiesMock).toHaveBeenCalled();
  });

  it('throws SESSION_EXPIRED when refresh response is missing tokens', async () => {
    getAuthCookiesMock.mockReturnValue({
      authToken: '',
      refreshToken: 'rt',
    });
    refreshMock.mockResolvedValue({
      succeeded: true,
      tokens: { token: 'new', refreshToken: '' },
    });

    await expect(requireAuth(mockEvent)).rejects.toMatchObject({
      statusCode: 401,
      data: { code: 'SESSION_EXPIRED' },
    });
  });

  it('refreshes and rotates cookies on a successful refresh', async () => {
    getAuthCookiesMock.mockReturnValue({
      authToken: '',
      refreshToken: 'rt',
    });
    refreshMock.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'new-token',
        refreshToken: 'new-refresh',
        expiresIn: 3600,
      },
    });

    const tokens = await requireAuth(mockEvent);

    expect(tokens).toEqual({
      authToken: 'new-token',
      refreshToken: 'new-refresh',
    });
    expect(setAuthCookiesMock).toHaveBeenCalledWith(mockEvent, {
      token: 'new-token',
      refreshToken: 'new-refresh',
      expiresIn: 3600,
    });
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
  });

  it('throws UNAUTHORIZED (not SESSION_EXPIRED) when no tokens are present at all', async () => {
    getAuthCookiesMock.mockReturnValue({ authToken: '', refreshToken: '' });

    await expect(requireAuth(mockEvent)).rejects.toMatchObject({
      statusCode: 401,
      data: { code: 'UNAUTHORIZED' },
    });
  });
});

describe('optionalAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null instead of throwing when refresh fails', async () => {
    getAuthCookiesMock.mockReturnValue({
      authToken: '',
      refreshToken: 'rt',
    });
    refreshMock.mockRejectedValue(new Error('boom'));

    const result = await optionalAuth(mockEvent);

    expect(result).toBeNull();
    expect(clearAuthCookiesMock).toHaveBeenCalled();
  });
});
