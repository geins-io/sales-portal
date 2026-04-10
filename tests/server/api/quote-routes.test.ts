import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the service boundary — real Geins GraphQL, no stubs
// ---------------------------------------------------------------------------
const mockListQuotes = vi.fn();
const mockGetQuote = vi.fn();
const mockAcceptQuote = vi.fn();
const mockRejectQuote = vi.fn();

vi.mock('../../../server/services/quotes', () => ({
  listQuotes: (...args: unknown[]) => mockListQuotes(...args),
  getQuote: (...args: unknown[]) => mockGetQuote(...args),
  acceptQuote: (...args: unknown[]) => mockAcceptQuote(...args),
  rejectQuote: (...args: unknown[]) => mockRejectQuote(...args),
}));

// requireAuth — auto-imported from server/utils/auth
const mockRequireAuth = vi.fn();
vi.stubGlobal('requireAuth', mockRequireAuth);

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
vi.stubGlobal('setHeader', vi.fn());
vi.stubGlobal('getQuery', vi.fn());
vi.stubGlobal(
  'getValidatedQuery',
  vi.fn(async (_event: unknown, validator: (raw: unknown) => unknown) => {
    const query = (getQuery as ReturnType<typeof vi.fn>)(_event);
    return validator(query);
  }),
);
vi.stubGlobal('readValidatedBody', vi.fn());
vi.stubGlobal(
  'getRouterParam',
  vi.fn((_event: unknown, name: string) => {
    const event = _event as { context?: { params?: Record<string, string> } };
    return event?.context?.params?.[name];
  }),
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockTokens = {
  authToken: 'auth-token-abc',
  refreshToken: 'refresh-token-xyz',
};

const mockQuote = {
  id: 'quote-uuid-001',
  quoteNumber: 'Q-001',
  status: 'pending' as const,
  total: 0,
  totalFormatted: '0 SEK',
  currency: 'SEK',
  createdAt: '2026-03-01T10:00:00Z',
};

const mockEvent = {
  context: {
    tenant: { hostname: 'test.example.com', tenantId: 'test-tenant' },
    params: {},
  },
  node: { req: { headers: {} } },
} as unknown as import('h3').H3Event;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Quote API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockTokens);
  });

  // -------------------------------------------------------------------------
  // GET /api/quotes
  // -------------------------------------------------------------------------
  describe('GET /api/quotes', () => {
    it('returns quotes list', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ skip: '0', take: '10' });
      const listResult = { quotes: [mockQuote], total: 1 };
      mockListQuotes.mockResolvedValue(listResult);

      const handler = (await import('../../../server/api/quotes/index.get'))
        .default;
      const result = await handler(mockEvent);

      expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
      expect(mockListQuotes).toHaveBeenCalledWith('', 0, 10, mockEvent);
      expect(result).toEqual(listResult);
    });

    it('returns empty list with default pagination', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({});
      mockListQuotes.mockResolvedValue({ quotes: [], total: 0 });

      const handler = (await import('../../../server/api/quotes/index.get'))
        .default;
      const result = await handler(mockEvent);

      expect(mockListQuotes).toHaveBeenCalledWith(
        '',
        undefined,
        undefined,
        mockEvent,
      );
      expect(result).toEqual({ quotes: [], total: 0 });
    });

    it('requires authentication', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Authentication required'));
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({});

      const handler = (await import('../../../server/api/quotes/index.get'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow(
        'Authentication required',
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/quotes/[id]
  // -------------------------------------------------------------------------
  describe('GET /api/quotes/[id]', () => {
    it('returns a specific quote by id', async () => {
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;
      mockGetQuote.mockResolvedValue(mockQuote);

      const handler = (await import('../../../server/api/quotes/[id].get'))
        .default;
      const result = await handler(eventWithId);

      expect(mockRequireAuth).toHaveBeenCalledWith(eventWithId);
      expect(mockGetQuote).toHaveBeenCalledWith('quote-uuid-001', eventWithId);
      expect(result).toEqual({ quote: mockQuote });
    });

    it('requires authentication', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Authentication required'));
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;

      const handler = (await import('../../../server/api/quotes/[id].get'))
        .default;

      await expect(handler(eventWithId)).rejects.toThrow(
        'Authentication required',
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/quotes/[id]/accept
  // -------------------------------------------------------------------------
  describe('POST /api/quotes/[id]/accept', () => {
    it('accepts a quote', async () => {
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;
      const accepted = { ...mockQuote, status: 'accepted' };
      mockAcceptQuote.mockResolvedValue(accepted);

      const handler = (
        await import('../../../server/api/quotes/[id]/accept.post')
      ).default;
      const result = await handler(eventWithId);

      expect(mockRequireAuth).toHaveBeenCalledWith(eventWithId);
      expect(mockAcceptQuote).toHaveBeenCalledWith(
        'quote-uuid-001',
        eventWithId,
      );
      expect(result).toEqual({ quote: accepted });
    });

    it('requires authentication', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Authentication required'));
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;

      const handler = (
        await import('../../../server/api/quotes/[id]/accept.post')
      ).default;

      await expect(handler(eventWithId)).rejects.toThrow(
        'Authentication required',
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/quotes/[id]/reject
  // -------------------------------------------------------------------------
  describe('POST /api/quotes/[id]/reject', () => {
    it('rejects a quote with reason', async () => {
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({
          quoteId: 'quote-uuid-001',
          reason: 'Price too high',
        });
      });
      const rejected = { ...mockQuote, status: 'rejected' };
      mockRejectQuote.mockResolvedValue(rejected);

      const handler = (
        await import('../../../server/api/quotes/[id]/reject.post')
      ).default;
      const result = await handler(eventWithId);

      expect(mockRequireAuth).toHaveBeenCalledWith(eventWithId);
      expect(mockRejectQuote).toHaveBeenCalledWith(
        'quote-uuid-001',
        'Price too high',
        eventWithId,
      );
      expect(result).toEqual({ quote: rejected });
    });

    it('rejects without a reason', async () => {
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({ quoteId: 'quote-uuid-001' });
      });
      const rejected = { ...mockQuote, status: 'rejected' };
      mockRejectQuote.mockResolvedValue(rejected);

      const handler = (
        await import('../../../server/api/quotes/[id]/reject.post')
      ).default;
      const result = await handler(eventWithId);

      expect(result).toEqual({ quote: rejected });
    });

    it('requires authentication', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Authentication required'));
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({});
      });

      const handler = (
        await import('../../../server/api/quotes/[id]/reject.post')
      ).default;

      await expect(handler(eventWithId)).rejects.toThrow(
        'Authentication required',
      );
    });
  });
});
