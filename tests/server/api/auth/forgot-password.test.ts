import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let user service run for real
// ---------------------------------------------------------------------------
const mockPasswordRequestReset = vi.fn().mockResolvedValue({ succeeded: true });

const mockSDK = {
  crm: {
    user: {
      password: {
        requestReset: mockPasswordRequestReset,
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
  forgotPasswordRateLimiter: {
    check: (...args: unknown[]) => mockCheck(...args),
  },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal('readValidatedBody', vi.fn());
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  RATE_LIMITED: 'RATE_LIMITED',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
});
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

describe('POST /api/auth/forgot-password', () => {
  const mockEvent = {} as unknown as import('h3').H3Event;

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
      email: 'user@example.com',
    });
  });

  it('returns success: true regardless of email existence', async () => {
    const handler = (
      await import('../../../../server/api/auth/forgot-password.post')
    ).default;
    const result = await handler(mockEvent);
    expect(result).toEqual({ success: true });
  });

  it('calls SDK password.requestReset with the email', async () => {
    const handler = (
      await import('../../../../server/api/auth/forgot-password.post')
    ).default;
    await handler(mockEvent);
    expect(mockPasswordRequestReset).toHaveBeenCalledWith('user@example.com');
  });

  it('still returns success: true when SDK throws (email not found)', async () => {
    mockPasswordRequestReset.mockRejectedValueOnce(new Error('User not found'));
    const handler = (
      await import('../../../../server/api/auth/forgot-password.post')
    ).default;
    const result = await handler(mockEvent);
    expect(result).toEqual({ success: true });
  });

  it('throws RATE_LIMITED when rate limit exceeded', async () => {
    mockCheck.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: 0,
    });
    const handler = (
      await import('../../../../server/api/auth/forgot-password.post')
    ).default;
    await expect(handler(mockEvent)).rejects.toThrow('RATE_LIMITED');
  });
});
