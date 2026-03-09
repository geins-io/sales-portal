import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let user service run for real
// ---------------------------------------------------------------------------
const mockUserUpdate = vi.fn();

const mockSDK = {
  crm: {
    user: {
      update: mockUserUpdate,
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

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal('readValidatedBody', vi.fn());
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
});
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

describe('PUT /api/user/profile', () => {
  const mockEvent = {} as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      authToken: 'test-auth-token',
      refreshToken: 'test-refresh-token',
    });
    (
      globalThis.readValidatedBody as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      address: { firstName: 'Jane', lastName: 'Doe' },
    });
  });

  it('updates profile via SDK and returns result', async () => {
    const updatedProfile = {
      id: 1,
      email: 'user@example.com',
      address: { firstName: 'Jane', lastName: 'Doe' },
    };
    mockUserUpdate.mockResolvedValue(updatedProfile);

    const handler = (await import('../../../../server/api/user/profile.put'))
      .default;
    const result = await handler(mockEvent);

    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      { address: { firstName: 'Jane', lastName: 'Doe' } },
      'test-auth-token',
    );
    expect(result).toEqual({ profile: updatedProfile });
  });

  it('throws BAD_REQUEST when SDK returns undefined', async () => {
    mockUserUpdate.mockResolvedValue(undefined);

    const handler = (await import('../../../../server/api/user/profile.put'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('BAD_REQUEST');
  });
});
