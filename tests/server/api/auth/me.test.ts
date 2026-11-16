import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventWithChannelSettings } from '../../mock-event';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the SDK boundary
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();

vi.mock('../../../../server/services/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

const mockGetCompany = vi.fn().mockResolvedValue(null);
vi.mock('../../../../server/services/company', () => ({
  getCompany: (...args: unknown[]) => mockGetCompany(...args),
}));

const mockGetChannel = vi.fn().mockResolvedValue(null);
vi.mock('../../../../server/services/channels', () => ({
  getChannel: (...args: unknown[]) => mockGetChannel(...args),
}));

const mockSetMarketCookie = vi.fn();
const mockGetMarketCookie = vi.fn();
vi.mock('../../../../server/utils/cookies', () => ({
  setMarketCookie: (...args: unknown[]) => mockSetMarketCookie(...args),
  getMarketCookie: (...args: unknown[]) => mockGetMarketCookie(...args),
}));

// ---------------------------------------------------------------------------
// Stub Nitro / h3 auto-imports
// ---------------------------------------------------------------------------
const mockOptionalAuth = vi.fn();
const mockGetPreviewCookie = vi.fn();
const mockGetAuthCookies = vi.fn();
const mockClearAuthCookies = vi.fn();
const mockGetSpoofedByCookie = vi.fn();

vi.stubGlobal('optionalAuth', mockOptionalAuth);
vi.stubGlobal('getPreviewCookie', mockGetPreviewCookie);
vi.stubGlobal('getAuthCookies', mockGetAuthCookies);
vi.stubGlobal('clearAuthCookies', mockClearAuthCookies);
vi.stubGlobal('getSpoofedByCookie', mockGetSpoofedByCookie);
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
});

// decodeJwtPayload is exported from auth.ts — stub it globally for the handler
const { decodeJwtPayload, isExpiringSoon, EXPIRES_SOON_SECONDS } =
  await import('../../../../server/utils/auth');
vi.stubGlobal('decodeJwtPayload', decodeJwtPayload);
vi.stubGlobal('isExpiringSoon', isExpiringSoon);

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

let mockEvent = { context: {} } as import('h3').H3Event;

function jwtWithSecondsLeft(secondsLeft: number): string {
  return fakeJwt({ exp: Math.floor(Date.now() / 1000) + secondsLeft });
}

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvent = { context: {} } as import('h3').H3Event;
    mockGetPreviewCookie.mockReturnValue(false);
    mockGetSpoofedByCookie.mockReturnValue(undefined);
  });

  // -----------------------------------------------------------------------
  // The SDK's getUser refreshes on its own below EXPIRES_SOON_SECONDS and
  // this handler would discard what it got back
  // -----------------------------------------------------------------------
  it('answers from the rotation when this request rotated, without calling getUser', async () => {
    const rotated = jwtWithSecondsLeft(900);
    mockEvent.context.session = {
      status: 'active',
      tokens: { authToken: rotated, refreshToken: 'rotated-refresh' },
      rotation: {
        succeeded: true,
        tokens: { expiresIn: 900 },
        user: { id: 1, email: 'buyer@example.com' },
      },
    };
    mockOptionalAuth.mockResolvedValue({
      authToken: rotated,
      refreshToken: 'rotated-refresh',
    });

    const result = await handler(mockEvent);

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      user: { id: 1, email: 'buyer@example.com' },
      expiresAt: expect.any(String),
    });
  });

  it('calls getUser for a token with time left', async () => {
    const token = jwtWithSecondsLeft(EXPIRES_SOON_SECONDS + 60);
    mockOptionalAuth.mockResolvedValue({
      authToken: token,
      refreshToken: 'refresh-token',
    });
    mockGetUser.mockResolvedValue({
      succeeded: true,
      tokens: { expiresIn: 600 },
      user: { id: 1 },
    });

    await handler(mockEvent);

    expect(mockGetUser).toHaveBeenCalledWith('refresh-token', token, mockEvent);
  });

  it('never hands getUser a token about to expire, and keeps the cookies', async () => {
    // Only reachable when the rotation could not be decided (internal error).
    mockOptionalAuth.mockResolvedValue({
      authToken: jwtWithSecondsLeft(EXPIRES_SOON_SECONDS - 1),
      refreshToken: 'refresh-token',
    });

    const result = await handler(mockEvent);

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockClearAuthCookies).not.toHaveBeenCalled();
    expect(result).toEqual({ user: null });
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
      market: null,
    });
  });

  it('self-heals the market on session restore to the company-country market', async () => {
    mockOptionalAuth.mockResolvedValue({
      authToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    mockGetUser.mockResolvedValue({
      succeeded: true,
      tokens: { expiresIn: 3600 },
      user: { id: 1, email: 'buyer@example.com' },
    });
    mockGetMarketCookie.mockReturnValue('se');
    const eventWithTenant = eventWithChannelSettings({
      channelId: '1|se',
      defaultMarket: 'se',
    });
    mockGetCompany.mockResolvedValue({
      addresses: [{ addressId: '37', country: 'FI', addressType: 'shipping' }],
    });
    mockGetChannel.mockResolvedValue({
      markets: [
        {
          id: 'SE|SEK',
          alias: 'se',
          country: { code: 'SE' },
          currency: { code: 'SEK' },
        },
        {
          id: 'FI|EUR',
          alias: 'fi',
          country: { code: 'FI' },
          currency: { code: 'EUR' },
        },
      ],
    });

    const result = await handler(eventWithTenant);

    expect(mockSetMarketCookie).toHaveBeenCalledWith(eventWithTenant, 'fi');
    expect(result).toMatchObject({ market: 'fi' });
  });

  it('clears the cookies when getUser does not succeed', async () => {
    mockOptionalAuth.mockResolvedValue({
      authToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    mockGetUser.mockResolvedValue({ succeeded: false, user: { id: 1 } });

    const result = await handler(mockEvent);

    expect(result).toEqual({ user: null });
    expect(mockClearAuthCookies).toHaveBeenCalled();
  });

  it('clears the cookies when getUser answers nothing', async () => {
    mockOptionalAuth.mockResolvedValue({
      authToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    mockGetUser.mockResolvedValue(undefined);

    expect(await handler(mockEvent)).toEqual({ user: null });
    expect(mockClearAuthCookies).toHaveBeenCalled();
  });

  it('returns null user when optionalAuth returns null', async () => {
    mockOptionalAuth.mockResolvedValue(null);

    const result = await handler(mockEvent);

    expect(result).toEqual({ user: null });
  });

  // -----------------------------------------------------------------------
  // CMS preview is a key to CMS content, not a sign-in
  // -----------------------------------------------------------------------
  it('answers signed out in preview when nobody signed in', async () => {
    mockGetPreviewCookie.mockReturnValue(true);
    mockGetAuthCookies.mockReturnValue({
      authToken: fakeJwt({
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name':
          'AdminPreview',
      }),
      refreshToken: undefined,
    });
    mockOptionalAuth.mockResolvedValue(null);

    const result = await handler(mockEvent);

    expect(result).toEqual({ user: null });
  });

  it('answers the buyer who signed in during preview, from Geins', async () => {
    mockGetPreviewCookie.mockReturnValue(true);
    mockGetAuthCookies.mockReturnValue({
      authToken: 'buyer-token',
      refreshToken: 'buyer-refresh',
    });
    mockOptionalAuth.mockResolvedValue({
      authToken: 'buyer-token',
      refreshToken: 'buyer-refresh',
    });
    mockGetUser.mockResolvedValue({
      succeeded: true,
      tokens: { expiresIn: 3600 },
      user: { id: 7, email: 'buyer@example.com' },
    });

    const result = await handler(mockEvent);

    expect(mockGetUser).toHaveBeenCalledWith(
      'buyer-refresh',
      'buyer-token',
      mockEvent,
    );
    expect(result).toMatchObject({
      user: { id: 7, email: 'buyer@example.com' },
    });
  });

  // -----------------------------------------------------------------------
  // Impersonation mode (login-as-customer) — spoofed-by cookie, no preview
  // -----------------------------------------------------------------------
  it('returns synthetic user from JWT when spoofed-by cookie is set', async () => {
    const token = fakeJwt({
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name':
        'customer@example.com',
      CustomerType: 'ORGANIZATION',
      MemberId: '42',
      SpoofedBy: 'admin@example.com',
    });

    mockGetSpoofedByCookie.mockReturnValue('admin@example.com');
    mockGetAuthCookies.mockReturnValue({
      authToken: token,
      refreshToken: undefined,
    });

    const result = await handler(mockEvent);

    expect(result).toEqual({
      user: {
        username: 'customer@example.com',
        customerType: 'ORGANIZATION',
        memberId: '42',
      },
      spoofedBy: 'admin@example.com',
    });
    expect(mockOptionalAuth).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('returns null user in impersonation mode when the JWT is malformed', async () => {
    mockGetSpoofedByCookie.mockReturnValue('admin@example.com');
    mockGetAuthCookies.mockReturnValue({
      authToken: 'not-a-valid-jwt',
      refreshToken: undefined,
    });

    const result = await handler(mockEvent);

    expect(result).toEqual({ user: null });
  });

  it('returns null user in impersonation mode when no auth token', async () => {
    mockGetSpoofedByCookie.mockReturnValue('admin@example.com');
    mockGetAuthCookies.mockReturnValue({
      authToken: undefined,
      refreshToken: undefined,
    });

    const result = await handler(mockEvent);

    expect(result).toEqual({ user: null });
  });
});
