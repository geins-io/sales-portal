import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let user service run for real
// ---------------------------------------------------------------------------
const mockPasswordChange = vi.fn();

const mockSDK = {
  crm: {
    user: {
      password: {
        change: mockPasswordChange,
      },
    },
  },
};

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
}));

// Rate limiter — uses useStorage('kv'), must stay mocked
const mockCheck = vi
  .fn()
  .mockResolvedValue({ allowed: true, remaining: 4, resetTime: 0 });
vi.mock('../../../../server/utils/rate-limiter', () => ({
  changePasswordRateLimiter: {
    check: (...args: unknown[]) => mockCheck(...args),
  },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

// requireAuth reads cookies — must stay mocked
const mockRequireAuth = vi.fn().mockResolvedValue({
  authToken: 'test-auth-token',
  refreshToken: 'test-refresh-token',
});
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
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
  BAD_REQUEST: 'BAD_REQUEST',
});
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

describe('POST /api/user/change-password', () => {
  const mockEvent = {} as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      authToken: 'test-auth-token',
      refreshToken: 'test-refresh-token',
    });
    mockCheck.mockResolvedValue({ allowed: true, remaining: 4, resetTime: 0 });
    (
      globalThis.readValidatedBody as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      currentPassword: 'old123456',
      newPassword: 'new123456',
    });
  });

  it('changes password via SDK and returns success', async () => {
    mockPasswordChange.mockResolvedValue({ succeeded: true });

    const handler = (
      await import('../../../../server/api/user/change-password.post')
    ).default;
    const result = await handler(mockEvent);

    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockPasswordChange).toHaveBeenCalledWith(
      { username: '', password: 'old123456', newPassword: 'new123456' },
      'test-refresh-token',
    );
    expect(result).toEqual({ success: true });
  });

  it('throws RATE_LIMITED when rate limit exceeded', async () => {
    mockCheck.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: 0,
    });

    const handler = (
      await import('../../../../server/api/user/change-password.post')
    ).default;
    await expect(handler(mockEvent)).rejects.toThrow('RATE_LIMITED');
  });

  it('throws BAD_REQUEST when SDK returns undefined', async () => {
    mockPasswordChange.mockResolvedValue(undefined);

    const handler = (
      await import('../../../../server/api/user/change-password.post')
    ).default;
    await expect(handler(mockEvent)).rejects.toThrow('BAD_REQUEST');
  });
});
