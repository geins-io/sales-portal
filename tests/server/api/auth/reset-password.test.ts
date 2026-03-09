import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let user service run for real
// ---------------------------------------------------------------------------
const mockPasswordCommitReset = vi.fn().mockResolvedValue({ succeeded: true });

const mockSDK = {
  crm: {
    user: {
      password: {
        commitReset: mockPasswordCommitReset,
      },
    },
  },
};

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
}));

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal('readValidatedBody', vi.fn());
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
});
vi.stubGlobal(
  'getClientIp',
  vi.fn(() => '127.0.0.1'),
);
vi.stubGlobal('resetPasswordRateLimiter', {
  check: vi.fn().mockResolvedValue({ allowed: true, remaining: 4 }),
});
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

describe('POST /api/auth/reset-password', () => {
  const mockEvent = {} as unknown as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    (
      globalThis.readValidatedBody as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      resetKey: 'key123',
      password: 'newpass88',
    });
  });

  it('calls SDK password.commitReset with resetKey and password', async () => {
    const handler = (
      await import('../../../../server/api/auth/reset-password.post')
    ).default;
    await handler(mockEvent);
    expect(mockPasswordCommitReset).toHaveBeenCalledWith('key123', 'newpass88');
  });

  it('returns success: true on successful reset', async () => {
    const handler = (
      await import('../../../../server/api/auth/reset-password.post')
    ).default;
    const result = await handler(mockEvent);
    expect(result).toEqual({ success: true });
  });

  it('throws BAD_REQUEST when SDK returns null', async () => {
    mockPasswordCommitReset.mockResolvedValueOnce(null);
    const handler = (
      await import('../../../../server/api/auth/reset-password.post')
    ).default;
    await expect(handler(mockEvent)).rejects.toThrow('BAD_REQUEST');
  });

  it('throws when SDK throws (invalid/expired key)', async () => {
    mockPasswordCommitReset.mockRejectedValueOnce(new Error('Invalid key'));
    const handler = (
      await import('../../../../server/api/auth/reset-password.post')
    ).default;
    await expect(handler(mockEvent)).rejects.toThrow('Invalid key');
  });
});
