import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

const mockCheck = vi
  .fn()
  .mockResolvedValue({ allowed: true, remaining: 4, resetTime: 0 });
vi.mock('../../../../server/utils/rate-limiter', () => ({
  loginRateLimiter: {
    check: (...args: unknown[]) => mockCheck(...args),
  },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

const mockLogin = vi.fn();
vi.mock('../../../../server/services/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

const mockSetAuthCookies = vi.fn();
vi.stubGlobal('setAuthCookies', mockSetAuthCookies);

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

describe('POST /api/auth/login', () => {
  const mockEvent = {} as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheck.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetTime: 0,
    });
    (
      globalThis.readValidatedBody as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      username: 'user@example.com',
      password: 'password123',
    });
  });

  it('returns user and expiresAt on successful login', async () => {
    const mockUser = { id: 1, email: 'user@example.com' };
    mockLogin.mockResolvedValue({
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

    expect(mockLogin).toHaveBeenCalledWith(
      { username: 'user@example.com', password: 'password123' },
      mockEvent,
    );
    expect(result).toHaveProperty('user', mockUser);
    expect(result).toHaveProperty('expiresAt');
    expect(result.expiresAt).toBeTruthy();
  });

  it('sets auth cookies on successful login', async () => {
    mockLogin.mockResolvedValue({
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
    });
  });

  it('throws UNAUTHORIZED when login fails', async () => {
    mockLogin.mockResolvedValue({ succeeded: false });

    const handler = (await import('../../../../server/api/auth/login.post'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('UNAUTHORIZED');
  });

  it('throws UNAUTHORIZED when tokens are missing', async () => {
    mockLogin.mockResolvedValue({
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

  it('returns null expiresAt when expiresIn is not provided', async () => {
    mockLogin.mockResolvedValue({
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
});
