import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the service boundary — stubs are pure in-memory, no SDK calls
// ---------------------------------------------------------------------------
const mockCreateQuote = vi.fn();
const mockListQuotes = vi.fn();
const mockGetQuote = vi.fn();
const mockAcceptQuote = vi.fn();
const mockRejectQuote = vi.fn();

vi.mock('../../../server/services/quotes', () => ({
  createQuote: (...args: unknown[]) => mockCreateQuote(...args),
  listQuotes: (...args: unknown[]) => mockListQuotes(...args),
  getQuote: (...args: unknown[]) => mockGetQuote(...args),
  acceptQuote: (...args: unknown[]) => mockAcceptQuote(...args),
  rejectQuote: (...args: unknown[]) => mockRejectQuote(...args),
}));

// requirePermission — b2b-auth utility (reads cookies + org service)
const mockRequirePermission = vi.fn();
vi.mock('../../../server/utils/b2b-auth', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

// Rate limiter — external resource
const mockRateLimiterCheck = vi.fn().mockResolvedValue({ allowed: true });
vi.mock('../../../server/utils/rate-limiter', () => ({
  quoteCreateRateLimiter: {
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
      code === 'UNAUTHORIZED'
        ? 401
        : code === 'FORBIDDEN'
          ? 403
          : code === 'RATE_LIMITED'
            ? 429
            : code === 'NOT_FOUND'
              ? 404
              : 400;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
});
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
const mockBuyer = {
  userId: 'user-placer-003',
  organizationId: 'demo-org',
  firstName: 'Lisa',
  lastName: 'Andersson',
  email: 'lisa@acmecorp.se',
  role: 'order_placer' as const,
};

const mockAuthContext = {
  authToken: 'auth-token-abc',
  refreshToken: 'refresh-token-xyz',
  buyer: mockBuyer,
};

const mockQuote = {
  id: 'quote-uuid-001',
  quoteNumber: 'Q-001',
  organizationId: 'demo-org',
  createdBy: 'user-placer-003',
  contactName: 'Lisa Andersson',
  contactEmail: 'lisa@acmecorp.se',
  status: 'pending' as const,
  lineItems: [],
  subtotal: 0,
  subtotalFormatted: '0 SEK',
  tax: 0,
  taxFormatted: '0 SEK',
  total: 0,
  totalFormatted: '0 SEK',
  currency: 'SEK',
  expiresAt: '2026-04-01T00:00:00Z',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
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
    mockRequirePermission.mockResolvedValue(mockAuthContext);
    mockRateLimiterCheck.mockResolvedValue({ allowed: true });
  });

  // -------------------------------------------------------------------------
  // POST /api/quotes
  // -------------------------------------------------------------------------
  describe('POST /api/quotes', () => {
    it('creates a quote and returns it', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({
          cartId: 'cart-abc',
          message: 'Need for new office',
          poNumber: 'PO-001',
          paymentTerms: 'Net 30',
        });
      });
      mockCreateQuote.mockResolvedValue(mockQuote);

      const handler = (await import('../../../server/api/quotes/index.post'))
        .default;
      const result = await handler(mockEvent);

      expect(mockRequirePermission).toHaveBeenCalledWith(
        mockEvent,
        'quotes:create',
      );
      expect(mockCreateQuote).toHaveBeenCalledWith(
        'demo-org',
        'user-placer-003',
        'Lisa Andersson',
        'lisa@acmecorp.se',
        [],
        'Need for new office',
        'PO-001',
        'Net 30',
        mockEvent,
      );
      expect(result).toEqual({ quote: mockQuote });
    });

    it('is rate limited — blocks when rate limit exceeded', async () => {
      mockRateLimiterCheck.mockResolvedValue({ allowed: false });
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({ cartId: 'cart-abc' });
      });

      const handler = (await import('../../../server/api/quotes/index.post'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow('Too many quote');
    });

    it('requires quotes:create permission', async () => {
      mockRequirePermission.mockRejectedValue(
        new Error('Missing permission: quotes:create'),
      );

      const handler = (await import('../../../server/api/quotes/index.post'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow(
        'Missing permission: quotes:create',
      );
    });

    it('throws on invalid body (missing cartId)', async () => {
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({});
      });

      const handler = (await import('../../../server/api/quotes/index.post'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/quotes
  // -------------------------------------------------------------------------
  describe('GET /api/quotes', () => {
    it('returns quotes list with total count', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({ skip: '0', take: '10' });
      const listResult = {
        quotes: [
          {
            id: 'quote-uuid-001',
            quoteNumber: 'Q-001',
            contactName: 'Lisa Andersson',
            contactEmail: 'lisa@acmecorp.se',
            status: 'pending' as const,
            total: 0,
            totalFormatted: '0 SEK',
            currency: 'SEK',
            itemCount: 0,
            createdAt: '2026-03-01T10:00:00Z',
          },
        ],
        total: 1,
      };
      mockListQuotes.mockResolvedValue(listResult);

      const handler = (await import('../../../server/api/quotes/index.get'))
        .default;
      const result = await handler(mockEvent);

      expect(mockRequirePermission).toHaveBeenCalledWith(
        mockEvent,
        'quotes:view_own',
      );
      expect(mockListQuotes).toHaveBeenCalledWith('demo-org', 0, 10, mockEvent);
      expect(result).toEqual(listResult);
    });

    it('returns quotes list with default pagination when no query params', async () => {
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({});
      mockListQuotes.mockResolvedValue({ quotes: [], total: 0 });

      const handler = (await import('../../../server/api/quotes/index.get'))
        .default;
      const result = await handler(mockEvent);

      expect(mockListQuotes).toHaveBeenCalledWith(
        'demo-org',
        undefined,
        undefined,
        mockEvent,
      );
      expect(result).toEqual({ quotes: [], total: 0 });
    });

    it('requires quotes:view_own permission', async () => {
      mockRequirePermission.mockRejectedValue(
        new Error('Missing permission: quotes:view_own'),
      );
      const getQueryMock = vi.mocked(getQuery);
      getQueryMock.mockReturnValue({});

      const handler = (await import('../../../server/api/quotes/index.get'))
        .default;

      await expect(handler(mockEvent)).rejects.toThrow(
        'Missing permission: quotes:view_own',
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

      expect(mockRequirePermission).toHaveBeenCalledWith(
        eventWithId,
        'quotes:view_own',
      );
      expect(mockGetQuote).toHaveBeenCalledWith('quote-uuid-001', eventWithId);
      expect(result).toEqual({ quote: mockQuote });
    });

    it('requires quotes:view_own permission', async () => {
      mockRequirePermission.mockRejectedValue(
        new Error('Missing permission: quotes:view_own'),
      );
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;

      const handler = (await import('../../../server/api/quotes/[id].get'))
        .default;

      await expect(handler(eventWithId)).rejects.toThrow(
        'Missing permission: quotes:view_own',
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/quotes/[id]/accept
  // -------------------------------------------------------------------------
  describe('POST /api/quotes/[id]/accept', () => {
    it('changes quote status to accepted and returns the updated quote', async () => {
      const acceptedQuote = { ...mockQuote, status: 'accepted' as const };
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;
      mockAcceptQuote.mockResolvedValue(acceptedQuote);

      const handler = (
        await import('../../../server/api/quotes/[id]/accept.post')
      ).default;
      const result = await handler(eventWithId);

      expect(mockRequirePermission).toHaveBeenCalledWith(
        eventWithId,
        'quotes:accept',
      );
      expect(mockAcceptQuote).toHaveBeenCalledWith(
        'quote-uuid-001',
        eventWithId,
      );
      expect(result).toEqual({ quote: acceptedQuote });
    });

    it('requires quotes:accept permission', async () => {
      mockRequirePermission.mockRejectedValue(
        new Error('Missing permission: quotes:accept'),
      );
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;

      const handler = (
        await import('../../../server/api/quotes/[id]/accept.post')
      ).default;

      await expect(handler(eventWithId)).rejects.toThrow(
        'Missing permission: quotes:accept',
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/quotes/[id]/reject
  // -------------------------------------------------------------------------
  describe('POST /api/quotes/[id]/reject', () => {
    it('changes quote status to rejected and returns the updated quote', async () => {
      const rejectedQuote = { ...mockQuote, status: 'rejected' as const };
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
      mockRejectQuote.mockResolvedValue(rejectedQuote);

      const handler = (
        await import('../../../server/api/quotes/[id]/reject.post')
      ).default;
      const result = await handler(eventWithId);

      expect(mockRequirePermission).toHaveBeenCalledWith(
        eventWithId,
        'quotes:reject',
      );
      expect(mockRejectQuote).toHaveBeenCalledWith(
        'quote-uuid-001',
        'Price too high',
        eventWithId,
      );
      expect(result).toEqual({ quote: rejectedQuote });
    });

    it('rejects without a reason (reason is optional)', async () => {
      const rejectedQuote = { ...mockQuote, status: 'rejected' as const };
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;
      const readBodyMock = vi.mocked(readValidatedBody);
      readBodyMock.mockImplementation(async (_event, parse) => {
        return (parse as AnyFn)({ quoteId: 'quote-uuid-001' });
      });
      mockRejectQuote.mockResolvedValue(rejectedQuote);

      const handler = (
        await import('../../../server/api/quotes/[id]/reject.post')
      ).default;
      await handler(eventWithId);

      expect(mockRejectQuote).toHaveBeenCalledWith(
        'quote-uuid-001',
        undefined,
        eventWithId,
      );
    });

    it('requires quotes:reject permission', async () => {
      mockRequirePermission.mockRejectedValue(
        new Error('Missing permission: quotes:reject'),
      );
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;

      const handler = (
        await import('../../../server/api/quotes/[id]/reject.post')
      ).default;

      await expect(handler(eventWithId)).rejects.toThrow(
        'Missing permission: quotes:reject',
      );
    });
  });
});
