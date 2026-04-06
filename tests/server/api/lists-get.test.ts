import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the service boundary
// ---------------------------------------------------------------------------
const mockGetLists = vi.fn();

vi.mock('../../../server/services/saved-lists', () => ({
  getLists: (...args: unknown[]) => mockGetLists(...args),
}));

const mockRequireAuth = vi.fn();
vi.mock('../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockGetUser = vi.fn();
vi.mock('../../../server/services/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

// ---------------------------------------------------------------------------
// Stub Nitro / h3 auto-imports
// ---------------------------------------------------------------------------
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => {
    const err = new Error(msg);
    (err as Error & { statusCode: number }).statusCode =
      code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : 400;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
});
vi.stubGlobal(
  'withErrorHandling',
  vi.fn(async (fn: AnyFn) => fn()),
);
vi.stubGlobal('setResponseHeader', vi.fn());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockTokens = {
  authToken: 'auth-token-abc',
  refreshToken: 'refresh-token-xyz',
};

const mockAuthResult = {
  succeeded: true,
  user: { userId: 'user-admin-001' },
};

const mockLists = [
  {
    id: 'list-1',
    userId: 'user-admin-001',
    name: 'Office Supplies',
    items: [],
    createdBy: 'user-admin-001',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
];

const mockEvent = {
  context: {
    tenant: { hostname: 'test.example.com', tenantId: 'test-tenant' },
  },
  node: { req: { headers: {} } },
} as unknown as import('h3').H3Event;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockTokens);
    mockGetUser.mockResolvedValue(mockAuthResult);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    );

    const handler = (await import('../../../server/api/lists/index.get'))
      .default;

    await expect(handler(mockEvent)).rejects.toThrow('Authentication required');
  });

  it('returns lists array and total on success', async () => {
    mockGetLists.mockResolvedValue(mockLists);

    const handler = (await import('../../../server/api/lists/index.get'))
      .default;
    const result = await handler(mockEvent);

    expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
    expect(mockGetUser).toHaveBeenCalledWith(
      mockTokens.refreshToken,
      mockTokens.authToken,
      mockEvent,
    );
    expect(mockGetLists).toHaveBeenCalledWith('user-admin-001', mockEvent);
    expect(result).toEqual({ lists: mockLists, total: 1 });
  });

  it('returns empty lists for user with no lists', async () => {
    mockGetLists.mockResolvedValue([]);

    const handler = (await import('../../../server/api/lists/index.get'))
      .default;
    const result = await handler(mockEvent);

    expect(result).toEqual({ lists: [], total: 0 });
  });
});
