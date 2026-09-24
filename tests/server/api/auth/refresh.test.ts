import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { H3Event } from 'h3';

type Handler = (event: H3Event) => Promise<unknown>;

const refreshMock = vi.fn();
vi.mock('../../../../server/services/auth', () => ({
  refresh: (...args: unknown[]) => refreshMock(...args),
}));

vi.mock('../../../../server/utils/rate-limiter', () => ({
  refreshRateLimiter: { check: vi.fn().mockResolvedValue({ allowed: true }) },
  getClientIp: () => '127.0.0.1',
}));

const getAuthCookiesMock = vi.fn();
const setAuthCookiesMock = vi.fn();
const clearAuthCookiesMock = vi.fn();
vi.stubGlobal('getAuthCookies', getAuthCookiesMock);
vi.stubGlobal('setAuthCookies', setAuthCookiesMock);
vi.stubGlobal('clearAuthCookies', clearAuthCookiesMock);
vi.stubGlobal('defineEventHandler', (fn: Handler) => fn);

const errors = await import('../../../../server/utils/errors');
vi.stubGlobal('createAppError', errors.createAppError);
vi.stubGlobal('ErrorCode', errors.ErrorCode);

const handler = (await import('../../../../server/api/auth/refresh.post'))
  .default as unknown as Handler;

const event = () =>
  ({ context: { tenant: { hostname: 'shop.example' } } }) as unknown as H3Event;

let n = 0;

beforeEach(() => {
  // Frozen, so both answers compute the same expiresAt.
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 8, 24, 12, 0, 0) + n * 60_000);
  refreshMock.mockReset();
  setAuthCookiesMock.mockReset();
  clearAuthCookiesMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /api/auth/refresh', () => {
  it('answers a second call with the same refresh cookie from the shared rotation, user included', async () => {
    getAuthCookiesMock.mockReturnValue({ refreshToken: `rt-${++n}` });
    refreshMock.mockResolvedValue({
      succeeded: true,
      user: { username: 'buyer@example.com' },
      tokens: {
        token: 'new-token',
        refreshToken: 'new-refresh',
        expiresIn: 900,
      },
    });

    const first = await handler(event());
    const second = await handler(event());

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second).toMatchObject({ user: { username: 'buyer@example.com' } });
    expect(setAuthCookiesMock).toHaveBeenCalledTimes(2);
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
  });

  it('clears the cookies and answers 401 when Geins rejects', async () => {
    getAuthCookiesMock.mockReturnValue({ refreshToken: `rt-${++n}` });
    refreshMock.mockResolvedValue({ succeeded: false });

    await expect(handler(event())).rejects.toMatchObject({ statusCode: 401 });
    expect(clearAuthCookiesMock).toHaveBeenCalled();
  });
});
