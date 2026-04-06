import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the service boundary
// ---------------------------------------------------------------------------
const mockUpdateList = vi.fn();

vi.mock('../../../server/services/saved-lists', () => ({
  updateList: (...args: unknown[]) => mockUpdateList(...args),
}));

const mockRequireAuth = vi.fn();
vi.mock('../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockGetUser = vi.fn();
vi.mock('../../../server/services/auth', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

// Rate limiter
const mockRateLimiterCheck = vi.fn().mockResolvedValue({ allowed: true });
vi.mock('../../../server/utils/rate-limiter', () => ({
  savedListUpdateRateLimiter: {
    check: (...args: unknown[]) => mockRateLimiterCheck(...args),
  },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
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
  RATE_LIMITED: 'RATE_LIMITED',
});
vi.stubGlobal(
  'withErrorHandling',
  vi.fn(async (fn: AnyFn) => fn()),
);
vi.stubGlobal(
  'getRouterParam',
  vi.fn((_event: unknown, name: string) => {
    const event = _event as { context?: { params?: Record<string, string> } };
    return event?.context?.params?.[name];
  }),
);
vi.stubGlobal('readValidatedBody', vi.fn());

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

const mockUpdatedList = {
  id: 'list-uuid-001',
  userId: 'user-admin-001',
  name: 'Renamed List',
  items: [],
  createdBy: 'user-admin-001',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-04-01T10:00:00Z',
};

const mockEvent = {
  context: {
    tenant: { hostname: 'test.example.com', tenantId: 'test-tenant' },
    params: { id: 'list-uuid-001' },
  },
  node: { req: { headers: {} } },
} as unknown as import('h3').H3Event;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PUT /api/lists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockTokens);
    mockGetUser.mockResolvedValue(mockAuthResult);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    );

    const handler = (await import('../../../server/api/lists/[id].put'))
      .default;

    await expect(handler(mockEvent)).rejects.toThrow('Authentication required');
  });

  it('returns updated list on success', async () => {
    const readBodyMock = vi.mocked(readValidatedBody);
    readBodyMock.mockImplementation(async (_event, parse) => {
      return (parse as AnyFn)({ name: 'Renamed List' });
    });
    mockUpdateList.mockResolvedValue(mockUpdatedList);

    const handler = (await import('../../../server/api/lists/[id].put'))
      .default;
    const result = await handler(mockEvent);

    expect(mockUpdateList).toHaveBeenCalledWith(
      'list-uuid-001',
      'user-admin-001',
      { name: 'Renamed List' },
      mockEvent,
    );
    expect(result).toEqual({ list: mockUpdatedList });
  });

  it('validates body (rejects invalid name type)', async () => {
    const readBodyMock = vi.mocked(readValidatedBody);
    readBodyMock.mockImplementation(async (_event, parse) => {
      return (parse as AnyFn)({ name: 123 });
    });

    const handler = (await import('../../../server/api/lists/[id].put'))
      .default;

    await expect(handler(mockEvent)).rejects.toThrow();
  });
});
