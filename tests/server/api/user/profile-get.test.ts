import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

const mockGetUser = vi.fn();
vi.mock('../../../../server/services/user', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

const mockRequireAuth = vi.fn().mockResolvedValue({
  authToken: 'test-auth-token',
  refreshToken: 'test-refresh-token',
});
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
});

describe('GET /api/user/profile', () => {
  const mockEvent = {} as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      authToken: 'test-auth-token',
      refreshToken: 'test-refresh-token',
    });
  });

  it('returns user profile on success', async () => {
    const mockProfile = {
      id: 1,
      email: 'user@example.com',
      address: { firstName: 'John', lastName: 'Doe' },
    };
    mockGetUser.mockResolvedValue(mockProfile);

    const handler = (await import('../../../../server/api/user/profile.get'))
      .default;
    const result = await handler(mockEvent);

    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockGetUser).toHaveBeenCalledWith('test-auth-token', mockEvent);
    expect(result).toEqual({ profile: mockProfile });
  });

  it('throws BAD_REQUEST when user not found', async () => {
    mockGetUser.mockResolvedValue(undefined);

    const handler = (await import('../../../../server/api/user/profile.get'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('BAD_REQUEST');
  });
});
