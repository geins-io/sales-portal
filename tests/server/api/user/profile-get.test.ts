import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let user service run for real
// ---------------------------------------------------------------------------
const mockUserGet = vi.fn();

const mockSDK = {
  crm: {
    user: {
      get: mockUserGet,
    },
  },
};

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
}));

// requireAuth reads cookies — must stay mocked
const mockRequireAuth = vi.fn().mockResolvedValue({
  authToken: 'test-auth-token',
  refreshToken: 'test-refresh-token',
});
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.stubGlobal('setResponseHeader', vi.fn());
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
});
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

describe('GET /api/user/profile', () => {
  const mockEvent = {} as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      authToken: 'test-auth-token',
      refreshToken: 'test-refresh-token',
    });
  });

  it('returns user profile from SDK', async () => {
    const mockProfile = {
      id: 1,
      email: 'user@example.com',
      address: { firstName: 'John', lastName: 'Doe' },
    };
    mockUserGet.mockResolvedValue(mockProfile);

    const handler = (await import('../../../../server/api/user/profile.get'))
      .default;
    const result = await handler(mockEvent);

    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockUserGet).toHaveBeenCalledWith('test-auth-token');
    expect(result).toEqual({ profile: mockProfile });
  });

  it('throws BAD_REQUEST when SDK returns undefined', async () => {
    mockUserGet.mockResolvedValue(undefined);

    const handler = (await import('../../../../server/api/user/profile.get'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('BAD_REQUEST');
  });
});
