import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the SDK boundary
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();

vi.mock('../../../../server/services/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

// ---------------------------------------------------------------------------
// Stub Nitro / h3 auto-imports
// ---------------------------------------------------------------------------
const mockOptionalAuth = vi.fn();
const mockGetPreviewCookie = vi.fn();
const mockGetAuthCookies = vi.fn();
const mockClearAuthCookies = vi.fn();

vi.stubGlobal('optionalAuth', mockOptionalAuth);
vi.stubGlobal('getPreviewCookie', mockGetPreviewCookie);
vi.stubGlobal('getAuthCookies', mockGetAuthCookies);
vi.stubGlobal('clearAuthCookies', mockClearAuthCookies);
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
});

// decodeJwtPayload is exported from auth.ts — stub it globally for the handler
const { decodeJwtPayload } = await import('../../../../server/utils/auth');
vi.stubGlobal('decodeJwtPayload', decodeJwtPayload);

// ---------------------------------------------------------------------------
// Import handler AFTER mocks are wired
// ---------------------------------------------------------------------------
const handler = (await import('../../../../server/api/auth/me.get'))
  .default as AnyFn;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake JWT with the given payload. */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-sig`;
}

const mockEvent = {} as import('h3').H3Event;

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreviewCookie.mockReturnValue(false);
  });

  // -----------------------------------------------------------------------
  // Normal flow (non-preview)
  // -----------------------------------------------------------------------
  it('returns user from CRM when not in preview mode', async () => {
    mockOptionalAuth.mockResolvedValue({
      authToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    mockGetUser.mockResolvedValue({
      succeeded: true,
      tokens: { expiresIn: 3600 },
      user: { id: 1, email: 'user@example.com' },
    });

    const result = await handler(mockEvent);

    expect(mockOptionalAuth).toHaveBeenCalledWith(mockEvent);
    expect(result).toEqual({
      user: { id: 1, email: 'user@example.com' },
      expiresAt: expect.any(String),
    });
  });

  it('returns null user when optionalAuth returns null', async () => {
    mockOptionalAuth.mockResolvedValue(null);

    const result = await handler(mockEvent);

    expect(result).toEqual({ user: null });
  });

  // -----------------------------------------------------------------------
  // Preview mode — synthetic user from JWT
  // -----------------------------------------------------------------------
  it('returns synthetic user from JWT in preview mode', async () => {
    const token = fakeJwt({
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name':
        'preview-user@example.com',
      CustomerType: 'PERSON',
      MemberId: '12345',
    });

    mockGetPreviewCookie.mockReturnValue(true);
    mockGetAuthCookies.mockReturnValue({
      authToken: token,
      refreshToken: undefined,
    });

    const result = await handler(mockEvent);

    expect(result).toEqual({
      user: {
        username: 'preview-user@example.com',
        customerType: 'PERSON',
        memberId: '12345',
      },
      spoofedBy: undefined,
    });
    // Should NOT call optionalAuth or CRM getUser
    expect(mockOptionalAuth).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('returns spoofedBy when JWT contains SpoofedBy claim', async () => {
    const token = fakeJwt({
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name':
        'target-user@example.com',
      CustomerType: 'ORGANIZATION',
      MemberId: '99',
      SpoofedBy: 'admin@example.com',
    });

    mockGetPreviewCookie.mockReturnValue(true);
    mockGetAuthCookies.mockReturnValue({
      authToken: token,
      refreshToken: undefined,
    });

    const result = await handler(mockEvent);

    expect(result).toEqual({
      user: {
        username: 'target-user@example.com',
        customerType: 'ORGANIZATION',
        memberId: '99',
      },
      spoofedBy: 'admin@example.com',
    });
  });

  it('returns null user in preview mode when no auth token', async () => {
    mockGetPreviewCookie.mockReturnValue(true);
    mockGetAuthCookies.mockReturnValue({
      authToken: undefined,
      refreshToken: undefined,
    });

    const result = await handler(mockEvent);

    expect(result).toEqual({ user: null });
  });

  it('returns null user in preview mode when JWT is malformed', async () => {
    mockGetPreviewCookie.mockReturnValue(true);
    mockGetAuthCookies.mockReturnValue({
      authToken: 'not-a-valid-jwt',
      refreshToken: undefined,
    });

    const result = await handler(mockEvent);

    expect(result).toEqual({ user: null });
  });
});
