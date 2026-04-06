import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the service boundary
// ---------------------------------------------------------------------------
const mockCreateList = vi.fn();

vi.mock('../../../server/services/saved-lists', () => ({
  createList: (...args: unknown[]) => mockCreateList(...args),
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
vi.stubGlobal('readValidatedBody', vi.fn());
const mockSetResponseStatus = vi.fn();
vi.stubGlobal('setResponseStatus', mockSetResponseStatus);

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

const mockCreatedList = {
  id: 'new-list-id',
  userId: 'user-admin-001',
  name: 'New List',
  description: 'A fresh list',
  items: [],
  createdBy: 'user-admin-001',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
};

const mockEvent = {
  context: {
    tenant: { hostname: 'test.example.com', tenantId: 'test-tenant' },
  },
  node: { req: { headers: {} } },
} as unknown as import('h3').H3Event;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockTokens);
    mockGetUser.mockResolvedValue(mockAuthResult);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    );

    const handler = (await import('../../../server/api/lists/index.post'))
      .default;

    await expect(handler(mockEvent)).rejects.toThrow('Authentication required');
  });

  it('returns 201 and created list on success', async () => {
    const readBodyMock = vi.mocked(readValidatedBody);
    readBodyMock.mockImplementation(async (_event, parse) => {
      return (parse as AnyFn)({
        name: 'New List',
        description: 'A fresh list',
      });
    });
    mockCreateList.mockResolvedValue(mockCreatedList);

    const handler = (await import('../../../server/api/lists/index.post'))
      .default;
    const result = await handler(mockEvent);

    expect(mockCreateList).toHaveBeenCalledWith(
      'user-admin-001',
      { name: 'New List', description: 'A fresh list' },
      mockEvent,
    );
    expect(result).toEqual({ list: mockCreatedList });
  });

  it('throws on invalid body (missing name)', async () => {
    const readBodyMock = vi.mocked(readValidatedBody);
    readBodyMock.mockImplementation(async (_event, parse) => {
      return (parse as AnyFn)({});
    });

    const handler = (await import('../../../server/api/lists/index.post'))
      .default;

    await expect(handler(mockEvent)).rejects.toThrow();
  });
});
