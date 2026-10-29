import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventWithGeinsSettings } from '../../mock-event';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let auth service run for real
// ---------------------------------------------------------------------------
const mockAuthLogin = vi.fn();

const mockSDK = {
  crm: {
    auth: {
      login: mockAuthLogin,
      logout: vi.fn(),
      refresh: vi.fn(),
      getUser: vi.fn(),
    },
  },
};

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
}));

const mockCopyCart = vi.fn();
vi.mock('../../../../server/services/cart', () => ({
  copyCart: (...args: unknown[]) => mockCopyCart(...args),
}));

// Rate limiter — uses useStorage('kv'), must stay mocked
const mockCheck = vi
  .fn()
  .mockResolvedValue({ allowed: true, remaining: 4, resetTime: 0 });
const mockRefund = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../../server/utils/rate-limiter', () => ({
  loginRateLimiter: {
    check: (...args: unknown[]) => mockCheck(...args),
    refund: (...args: unknown[]) => mockRefund(...args),
  },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

const mockSetAuthCookies = vi.fn();
vi.stubGlobal('setAuthCookies', mockSetAuthCookies);

const mockGetCartCookie = vi.fn().mockReturnValue(undefined);
const mockSetCartCookie = vi.fn();
const mockClearCartCookie = vi.fn();
vi.stubGlobal('getCartCookie', mockGetCartCookie);
vi.stubGlobal('setCartCookie', mockSetCartCookie);
vi.stubGlobal('clearCartCookie', mockClearCartCookie);

const SID_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/sid';

/** A sign-in token for one buyer, carrying the claims Geins issues. */
function tokenFor(sid: string): string {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part({ [SID_CLAIM]: sid, MemberId: '2' })}.signature`;
}

// resolveBuyerMarket reads/writes the market cookie via cookies.ts which
// imports h3 helpers not present in the test environment. Mock both
// functions at the module boundary so we can assert behavior without
// pulling in the full h3 cookie machinery.
const mockSetMarketCookie = vi.fn();
const mockGetMarketCookie = vi.fn();
// The cart owner note runs for real against this jar.
const ownerJar = new Map<string, string>();
vi.mock('../../../../server/utils/cookies', () => ({
  setMarketCookie: (...args: unknown[]) => mockSetMarketCookie(...args),
  getMarketCookie: (...args: unknown[]) => mockGetMarketCookie(...args),
  getCartOwnerCookie: () => ownerJar.get('note'),
  setCartOwnerCookie: (_event: unknown, value: string) =>
    ownerJar.set('note', value),
  clearCartOwnerCookie: () => ownerJar.delete('note'),
}));

// Market resolution matches the company's delivery country (getCompany) to the
// channel's market catalog (getChannel), then picks the matching market.
const mockGetCompany = vi.fn().mockResolvedValue(null);
vi.mock('../../../../server/services/company', () => ({
  getCompany: (...args: unknown[]) => mockGetCompany(...args),
}));

const mockGetChannel = vi.fn().mockResolvedValue(null);
vi.mock('../../../../server/services/channels', () => ({
  getChannel: (...args: unknown[]) => mockGetChannel(...args),
}));

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal('readValidatedBody', vi.fn());
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
});
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

describe('POST /api/auth/login', () => {
  const mockEvent = {} as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    ownerJar.clear();
    mockGetCartCookie.mockReturnValue(undefined);
    mockCheck.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetTime: 0,
    });
    vi.mocked(readValidatedBody).mockResolvedValue({
      username: 'user@example.com',
      password: 'password123',
    });
  });

  it('returns user and expiresAt on successful login', async () => {
    const mockUser = { id: 1, email: 'user@example.com' };
    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
      user: mockUser,
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    const result = await handler(mockEvent);

    expect(result).toHaveProperty('user', mockUser);
    expect(result).toHaveProperty('expiresAt');
    expect(result.expiresAt).toBeTruthy();
  });

  it('sets auth cookies on successful login', async () => {
    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
      user: { id: 1 },
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await handler(mockEvent);

    expect(mockSetAuthCookies).toHaveBeenCalledWith(mockEvent, {
      token: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      rememberMe: true,
    });
  });

  it('passes rememberMe to setAuthCookies', async () => {
    vi.mocked(readValidatedBody).mockResolvedValue({
      username: 'user@example.com',
      password: 'password123',
      rememberMe: false,
    });

    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
      user: { id: 1 },
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await handler(mockEvent);

    expect(mockSetAuthCookies).toHaveBeenCalledWith(mockEvent, {
      token: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      rememberMe: false,
    });
  });

  it('throws UNAUTHORIZED when login fails', async () => {
    mockAuthLogin.mockResolvedValue({ succeeded: false });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('UNAUTHORIZED');
  });

  it('throws UNAUTHORIZED when tokens are missing', async () => {
    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: { token: null, refreshToken: null },
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('UNAUTHORIZED');
  });

  it('throws RATE_LIMITED when rate limit exceeded', async () => {
    mockCheck.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: 0,
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('RATE_LIMITED');
  });

  it('gives the limiter slot back after a successful login', async () => {
    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
      user: { id: 1 },
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await handler(mockEvent);

    expect(mockCheck).toHaveBeenCalledWith('127.0.0.1');
    expect(mockRefund).toHaveBeenCalledWith('127.0.0.1');
  });

  it('keeps the limiter slot taken after a failed login', async () => {
    mockAuthLogin.mockResolvedValue({ succeeded: false });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('UNAUTHORIZED');

    expect(mockCheck).toHaveBeenCalledWith('127.0.0.1');
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('keeps the limiter slot taken when tokens are missing', async () => {
    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: { token: 'access-token', refreshToken: null },
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('UNAUTHORIZED');

    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('keeps the limiter slot taken when the login call throws', async () => {
    mockAuthLogin.mockRejectedValue(new Error('upstream down'));

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow();

    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('does not authenticate when the limit is reached', async () => {
    mockCheck.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: 0,
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('RATE_LIMITED');

    expect(mockAuthLogin).not.toHaveBeenCalled();
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('returns null expiresAt when expiresIn is not provided', async () => {
    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: undefined,
      },
      user: { id: 1 },
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    const result = await handler(mockEvent);

    expect(result.expiresAt).toBeNull();
  });

  it('copies guest cart on login and updates cart cookie', async () => {
    mockGetCartCookie.mockReturnValue('guest-cart-123');
    mockCopyCart.mockResolvedValue({ id: 'authed-cart-456' });
    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
      user: { id: 1 },
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await handler(mockEvent);

    expect(mockCopyCart).toHaveBeenCalledWith(
      'guest-cart-123',
      mockEvent,
      'access-token',
    );
    expect(mockSetCartCookie).toHaveBeenCalledWith(
      mockEvent,
      'authed-cart-456',
    );
  });

  it('skips cart copy when no guest cart exists', async () => {
    mockGetCartCookie.mockReturnValue(undefined);
    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
      user: { id: 1 },
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await handler(mockEvent);

    expect(mockCopyCart).not.toHaveBeenCalled();
    expect(mockSetCartCookie).not.toHaveBeenCalled();
  });

  it('switches a Finnish-company buyer off the default SE market to FI', async () => {
    mockGetMarketCookie.mockReturnValue('se');
    const eventWithTenant = eventWithGeinsSettings({
      channel: '1',
      tld: 'se',
      market: 'se',
    });

    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
      user: { id: 1 },
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

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    const result = await handler(eventWithTenant);

    expect(mockSetMarketCookie).toHaveBeenCalledWith(eventWithTenant, 'fi');
    expect(result.market).toBe('fi');
  });

  it('leaves market unchanged when already on the company-country market', async () => {
    mockGetMarketCookie.mockReturnValue('fi');
    const eventWithTenant = eventWithGeinsSettings({
      channel: '1',
      tld: 'se',
      market: 'se',
    });

    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
      user: { id: 1 },
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

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    const result = await handler(eventWithTenant);

    expect(mockSetMarketCookie).not.toHaveBeenCalled();
    expect(result.market).toBeNull();
  });

  it('does not fail login when cart copy throws', async () => {
    mockGetCartCookie.mockReturnValue('guest-cart-123');
    mockCopyCart.mockRejectedValue(new Error('copy failed'));
    mockAuthLogin.mockResolvedValue({
      succeeded: true,
      tokens: {
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
      user: { id: 1 },
    });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    const result = await handler(mockEvent);

    expect(result).toHaveProperty('user');
    expect(mockSetCartCookie).not.toHaveBeenCalled();
  });
  describe('the cart a buyer gets at sign-in', () => {
    const A = 'buyer-a';
    const B = 'buyer-b';

    async function signIn(sid: string | null) {
      mockAuthLogin.mockResolvedValue({
        succeeded: true,
        tokens: {
          token: sid ? tokenFor(sid) : 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
        user: { id: 1 },
      });
      const handler = (await import('../../../../server/api/auth/login.post'))
        .default;
      return handler(mockEvent);
    }

    it('gives the buyer their noted cart and drops the guest cart unmerged', async () => {
      ownerJar.set('note', `${A}|cart-a`);
      mockGetCartCookie.mockReturnValue('guest-cart');

      await signIn(A);

      expect(mockSetCartCookie).toHaveBeenCalledWith(mockEvent, 'cart-a');
      expect(mockCopyCart).not.toHaveBeenCalled();
    });

    it('moves the buyer to the front of the note, so signing in alone keeps them from being evicted', async () => {
      ownerJar.set('note', `${B}|cart-b,${A}|cart-a`);

      await signIn(A);

      expect(ownerJar.get('note')).toBe(`${A}|cart-a,${B}|cart-b`);
    });

    it('gives the buyer their own cart back after an expired session', async () => {
      ownerJar.set('note', `${A}|cart-a`);
      mockGetCartCookie.mockReturnValue('cart-a');

      await signIn(A);

      expect(mockSetCartCookie).toHaveBeenCalledWith(mockEvent, 'cart-a');
      expect(mockCopyCart).not.toHaveBeenCalled();
    });

    it("gives another buyer no cart, and never copies or touches the noted buyer's cart", async () => {
      ownerJar.set('note', `${A}|cart-a`);
      mockGetCartCookie.mockReturnValue('cart-a');

      await signIn(B);

      expect(mockCopyCart).not.toHaveBeenCalled();
      expect(mockSetCartCookie).not.toHaveBeenCalled();
      expect(mockClearCartCookie).toHaveBeenCalledWith(mockEvent);
      expect(ownerJar.get('note')).toBe(`${A}|cart-a`);
    });

    it('copies a guest cart for a buyer with no note, and notes the copy as theirs', async () => {
      ownerJar.set('note', `${A}|cart-a`);
      mockGetCartCookie.mockReturnValue('guest-cart');
      mockCopyCart.mockResolvedValue({ id: 'cart-b' });

      await signIn(B);

      expect(mockCopyCart).toHaveBeenCalledWith(
        'guest-cart',
        mockEvent,
        tokenFor(B),
      );
      expect(mockSetCartCookie).toHaveBeenCalledWith(mockEvent, 'cart-b');
      expect(ownerJar.get('note')).toBe(`${B}|cart-b,${A}|cart-a`);
    });

    it('gives a new cart when the copy is refused, still signs the buyer in, and leaves the note as it was', async () => {
      ownerJar.set('note', `${A}|cart-a`);
      mockGetCartCookie.mockReturnValue('guest-cart');
      mockCopyCart.mockRejectedValue(new Error('copy refused'));

      const result = await signIn(B);

      expect(result).toHaveProperty('user');
      expect(mockSetCartCookie).not.toHaveBeenCalled();
      expect(mockClearCartCookie).toHaveBeenCalledWith(mockEvent);
      expect(ownerJar.get('note')).toBe(`${A}|cart-a`);
    });

    it('copies as before, and notes nothing, for a token without a buyer id', async () => {
      mockGetCartCookie.mockReturnValue('guest-cart');
      mockCopyCart.mockResolvedValue({ id: 'authed-cart' });

      await signIn(null);

      expect(mockSetCartCookie).toHaveBeenCalledWith(mockEvent, 'authed-cart');
      expect(ownerJar.has('note')).toBe(false);
    });

    it('gives a buyer with no note and no cart nothing until the first add', async () => {
      ownerJar.set('note', `${A}|cart-a`);

      await signIn(B);

      expect(mockCopyCart).not.toHaveBeenCalled();
      expect(mockSetCartCookie).not.toHaveBeenCalled();
    });
  });
});
