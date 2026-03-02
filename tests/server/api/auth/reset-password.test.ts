import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

const mockCommitPasswordReset = vi.fn().mockResolvedValue({ succeeded: true });
vi.mock('../../../../server/services/user', () => ({
  commitPasswordReset: (...args: unknown[]) => mockCommitPasswordReset(...args),
}));

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal('readValidatedBody', vi.fn());
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', { BAD_REQUEST: 'BAD_REQUEST' });

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

  it('calls commitPasswordReset with resetKey and password', async () => {
    const handler = (
      await import('../../../../server/api/auth/reset-password.post')
    ).default;
    await handler(mockEvent);
    expect(mockCommitPasswordReset).toHaveBeenCalledWith(
      'key123',
      'newpass88',
      mockEvent,
    );
  });

  it('returns success: true on successful reset', async () => {
    const handler = (
      await import('../../../../server/api/auth/reset-password.post')
    ).default;
    const result = await handler(mockEvent);
    expect(result).toEqual({ success: true });
  });

  it('throws BAD_REQUEST when SDK returns null', async () => {
    mockCommitPasswordReset.mockResolvedValueOnce(null);
    const handler = (
      await import('../../../../server/api/auth/reset-password.post')
    ).default;
    await expect(handler(mockEvent)).rejects.toThrow('BAD_REQUEST');
  });

  it('throws when SDK throws (invalid/expired key)', async () => {
    mockCommitPasswordReset.mockRejectedValueOnce(new Error('Invalid key'));
    const handler = (
      await import('../../../../server/api/auth/reset-password.post')
    ).default;
    await expect(handler(mockEvent)).rejects.toThrow('Invalid key');
  });
});
