import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the service boundary — real Geins GraphQL, no stubs
// ---------------------------------------------------------------------------
const mockListQuotes = vi.fn();
const mockGetQuote = vi.fn();
const mockGetQuoteNumber = vi.fn();
const mockAcceptQuote = vi.fn();
const mockRejectQuote = vi.fn();
const mockFinalizeQuote = vi.fn();
const mockCreateQuoteRequest = vi.fn();
const mockUpdateQuoteRequest = vi.fn();
const mockReleaseQuoteRequest = vi.fn();
const mockDeleteQuoteRequest = vi.fn();

vi.mock('../../../server/services/quotes', () => ({
  listQuotes: (...args: unknown[]) => mockListQuotes(...args),
  getQuote: (...args: unknown[]) => mockGetQuote(...args),
  getQuoteNumber: (...args: unknown[]) => mockGetQuoteNumber(...args),
  acceptQuote: (...args: unknown[]) => mockAcceptQuote(...args),
  rejectQuote: (...args: unknown[]) => mockRejectQuote(...args),
  finalizeQuote: (...args: unknown[]) => mockFinalizeQuote(...args),
  createQuoteRequest: (...args: unknown[]) => mockCreateQuoteRequest(...args),
  updateQuoteRequest: (...args: unknown[]) => mockUpdateQuoteRequest(...args),
  releaseQuoteRequest: (...args: unknown[]) => mockReleaseQuoteRequest(...args),
  deleteQuoteRequest: (...args: unknown[]) => mockDeleteQuoteRequest(...args),
}));

const mockGetCart = vi.fn();
vi.mock('../../../server/services/cart', () => ({
  getCart: (...args: unknown[]) => mockGetCart(...args),
}));

const mockForgetCart = vi.fn();
vi.mock('../../../server/utils/cart-owner', () => ({
  forgetCart: (...args: unknown[]) => mockForgetCart(...args),
}));

const mockGetCartCookie = vi.fn();
const mockClearCartCookie = vi.fn();
vi.stubGlobal('getCartCookie', mockGetCartCookie);
vi.stubGlobal('clearCartCookie', mockClearCartCookie);
vi.stubGlobal('getSessionToken', vi.fn().mockReturnValue('auth-token-abc'));

// requireAuth — auto-imported from server/utils/auth
const mockRequireAuth = vi.fn();
vi.stubGlobal('requireAuth', mockRequireAuth);
// The real feature-access helper imports it from the module.
vi.mock('../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  optionalAuth: vi.fn(),
}));

// Rate limiter — uses useStorage('kv'), must stay mocked
const mockRateLimitCheck = vi.fn();
const mockDraftRateLimitCheck = vi.fn();
vi.mock('../../../server/utils/rate-limiter', () => ({
  quoteRespondRateLimiter: {
    check: (...args: unknown[]) => mockRateLimitCheck(...args),
  },
  quoteDraftRateLimiter: {
    check: (...args: unknown[]) => mockDraftRateLimitCheck(...args),
  },
  getClientIp: vi.fn().mockReturnValue('203.0.113.7'),
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
        : code === 'NOT_FOUND'
          ? 404
          : code === 'RATE_LIMITED'
            ? 429
            : code === 'EMPTY_CART'
              ? 409
              : 400;
    (err as Error & { code: string }).code = code;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  EMPTY_CART: 'EMPTY_CART',
});
vi.stubGlobal('setHeader', vi.fn());
const getQueryMock = vi.fn();
vi.stubGlobal('getQuery', getQueryMock);
vi.stubGlobal(
  'getValidatedQuery',
  vi.fn(async (_event: unknown, validator: (raw: unknown) => unknown) => {
    const query = getQueryMock(_event);
    return validator(query);
  }),
);
const readBodyMock = vi.fn();
vi.stubGlobal(
  'readValidatedBody',
  vi.fn(async (_event: unknown, validator: (raw: unknown) => unknown) =>
    validator(readBodyMock(_event)),
  ),
);
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

/** An event on a tenant whose quotes and quoteRequests are as given. */
function eventOn(
  quotes: boolean | undefined,
  quoteRequests: boolean | undefined,
): import('h3').H3Event {
  const features = {
    ...(quotes === undefined ? {} : { quotes: { enabled: quotes } }),
    ...(quoteRequests === undefined
      ? {}
      : { quoteRequests: { enabled: quoteRequests } }),
  };
  return {
    context: {
      tenant: {
        hostname: 'test.example.com',
        tenantId: 'test-tenant',
        config: { features },
      },
      params: {},
    },
    node: { req: { headers: {} } },
  } as unknown as import('h3').H3Event;
}

const mockEvent = eventOn(true, true);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Quote API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockTokens);
    mockRateLimitCheck.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetTime: 0,
    });
    mockDraftRateLimitCheck.mockResolvedValue({
      allowed: true,
      remaining: 119,
      resetTime: 0,
    });
  });

  // Accept, reject and finalize share one limiter: the same checks run on all.
  describe.each([
    { route: 'accept', service: mockAcceptQuote },
    { route: 'reject', service: mockRejectQuote },
    { route: 'finalize', service: mockFinalizeQuote },
  ])('POST /api/quotes/[id]/$route rate limit', ({ route, service }) => {
    const eventWithId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
    } as unknown as import('h3').H3Event;

    const loadHandler = async () =>
      (await import(`../../../server/api/quotes/[id]/${route}.post.ts`))
        .default as (event: import('h3').H3Event) => Promise<unknown>;

    it('answers 429 and never calls Geins when the limit is reached', async () => {
      mockRateLimitCheck.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: 0,
      });

      const handler = await loadHandler();

      await expect(handler(eventWithId)).rejects.toMatchObject({
        statusCode: 429,
        message: 'Too many quote responses',
      });
      expect(service).not.toHaveBeenCalled();
    });

    it('keys the limit on the client IP', async () => {
      service.mockResolvedValue(mockQuote);

      const handler = await loadHandler();
      await handler(eventWithId);

      expect(mockRateLimitCheck).toHaveBeenCalledWith('203.0.113.7');
    });

    it('does not count requests that fail authentication', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Authentication required'));

      const handler = await loadHandler();

      await expect(handler(eventWithId)).rejects.toThrow(
        'Authentication required',
      );
      expect(mockRateLimitCheck).not.toHaveBeenCalled();
    });
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
  // GET /api/quotes/[id]/number
  // -------------------------------------------------------------------------
  describe('GET /api/quotes/[id]/number', () => {
    const eventWithId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
    } as unknown as import('h3').H3Event;
    const load = async () =>
      (await import('../../../server/api/quotes/[id]/number.get')).default;

    it("answers the quotation's number, for the buyer who can read it", async () => {
      mockGetQuoteNumber.mockResolvedValue('2611-2-0015-00');

      const result = await (await load())(eventWithId);

      expect(mockRequireAuth).toHaveBeenCalledWith(eventWithId);
      expect(mockGetQuoteNumber).toHaveBeenCalledWith(
        'quote-uuid-001',
        eventWithId,
      );
      expect(result).toEqual({ number: '2611-2-0015-00' });
    });

    it("is never cached past the buyer's own read", async () => {
      mockGetQuoteNumber.mockResolvedValue('2611-2-0015-00');

      await (
        await load()
      )(eventWithId);

      expect(setHeader).toHaveBeenCalledWith(
        eventWithId,
        'Cache-Control',
        'private, no-cache',
      );
    });

    it('passes a quotation the buyer cannot read on as its error', async () => {
      const notFound = Object.assign(new Error('Quote not found'), {
        statusCode: 404,
      });
      mockGetQuoteNumber.mockRejectedValue(notFound);

      await expect((await load())(eventWithId)).rejects.toBe(notFound);
    });

    it('requires authentication', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Authentication required'));

      await expect((await load())(eventWithId)).rejects.toThrow(
        'Authentication required',
      );
      expect(mockGetQuoteNumber).not.toHaveBeenCalled();
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
    it('rejects a quote without reading any body', async () => {
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;
      const rejected = { ...mockQuote, status: 'rejected' };
      mockRejectQuote.mockResolvedValue(rejected);

      const handler = (
        await import('../../../server/api/quotes/[id]/reject.post')
      ).default;
      const result = await handler(eventWithId);

      expect(mockRequireAuth).toHaveBeenCalledWith(eventWithId);
      expect(mockRejectQuote).toHaveBeenCalledWith(
        'quote-uuid-001',
        eventWithId,
      );
      expect(result).toEqual({ quote: rejected });
    });

    it('requires authentication', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Authentication required'));
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;

      const handler = (
        await import('../../../server/api/quotes/[id]/reject.post')
      ).default;

      await expect(handler(eventWithId)).rejects.toThrow(
        'Authentication required',
      );
    });

    // Withdrawing a sent request answers it; quoteRequests covers making and
    // changing one, so the route neither reads nor refuses.
    it('withdraws a REQUESTED quote when quoteRequests is disabled, without reading it first', async () => {
      const event = eventOn(true, false);
      event.context.params = { id: 'quote-uuid-001' };
      const rejected = { ...mockQuote, status: 'rejected' };
      mockRejectQuote.mockResolvedValue(rejected);

      const handler = (
        await import('../../../server/api/quotes/[id]/reject.post')
      ).default;

      await expect(handler(event)).resolves.toEqual({ quote: rejected });
      expect(mockGetQuote).not.toHaveBeenCalled();
      expect(mockRejectQuote).toHaveBeenCalledWith('quote-uuid-001', event);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/quotes/[id]/finalize
  // -------------------------------------------------------------------------
  describe('POST /api/quotes/[id]/finalize', () => {
    it('finalizes a quote and returns it with its order', async () => {
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;
      const finalized = { ...mockQuote, status: 'finalized', orderId: '1712' };
      mockFinalizeQuote.mockResolvedValue(finalized);

      const handler = (
        await import('../../../server/api/quotes/[id]/finalize.post')
      ).default;
      const result = await handler(eventWithId);

      expect(mockRequireAuth).toHaveBeenCalledWith(eventWithId);
      expect(mockFinalizeQuote).toHaveBeenCalledWith(
        'quote-uuid-001',
        eventWithId,
        {},
      );
      expect(result).toEqual({ quote: finalized });
    });

    describe('the order message', () => {
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;
      const load = async () =>
        (await import('../../../server/api/quotes/[id]/finalize.post')).default;

      beforeEach(() => mockFinalizeQuote.mockResolvedValue(mockQuote));

      it('passes the message on, and nothing else from the body', async () => {
        readBodyMock.mockReturnValue({
          message: 'Ring innan leverans',
          customerOrderNumber: 'PO-1',
        });

        await (
          await load()
        )(eventWithId);

        expect(mockFinalizeQuote).toHaveBeenCalledWith(
          'quote-uuid-001',
          eventWithId,
          { message: 'Ring innan leverans' },
        );
      });

      it('takes a message of 2000 characters', async () => {
        readBodyMock.mockReturnValue({ message: 'x'.repeat(2000) });

        await (
          await load()
        )(eventWithId);

        expect(mockFinalizeQuote.mock.calls[0]![2]).toEqual({
          message: 'x'.repeat(2000),
        });
      });

      it.each([
        ['a message over 2000 characters', { message: 'x'.repeat(2001) }],
        ['a message that is not text', { message: 42 }],
      ])('refuses %s and places no order', async (_label, body) => {
        readBodyMock.mockReturnValue(body);

        await expect((await load())(eventWithId)).rejects.toThrow();
        expect(mockFinalizeQuote).not.toHaveBeenCalled();
      });
    });

    it('requires authentication', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Authentication required'));
      const eventWithId = {
        ...mockEvent,
        context: { ...mockEvent.context, params: { id: 'quote-uuid-001' } },
      } as unknown as import('h3').H3Event;

      const handler = (
        await import('../../../server/api/quotes/[id]/finalize.post')
      ).default;

      await expect(handler(eventWithId)).rejects.toThrow(
        'Authentication required',
      );
      expect(mockFinalizeQuote).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Quote requests: create from the cart, update the details, send
  // -------------------------------------------------------------------------
  describe('quote requests', () => {
    const draft = { ...mockQuote, id: 'draft-001', status: 'request_draft' };
    const withId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'draft-001' } },
    } as unknown as import('h3').H3Event;

    type Handler = (event: import('h3').H3Event) => Promise<unknown>;
    // Literal paths: a template import resolves outside Stryker's sandbox.
    const handlers = {
      create: async () =>
        (await import('../../../server/api/quotes/requests.post'))
          .default as Handler,
      update: async () =>
        (await import('../../../server/api/quotes/[id]/request.patch'))
          .default as Handler,
      release: async () =>
        (await import('../../../server/api/quotes/[id]/release.post'))
          .default as Handler,
      delete: async () =>
        (await import('../../../server/api/quotes/[id].delete'))
          .default as Handler,
    };
    const load = (name: keyof typeof handlers) => handlers[name]();

    const requestRoutes = [
      {
        route: 'POST /api/quotes/requests',
        path: 'create' as const,
        service: mockCreateQuoteRequest,
        body: { name: 'Varukorg 2 nov 2026' },
        limiter: mockRateLimitCheck,
        other: mockDraftRateLimitCheck,
      },
      {
        route: 'PATCH /api/quotes/[id]/request',
        path: 'update' as const,
        service: mockUpdateQuoteRequest,
        body: { comment: 'Leverans till lager B' },
        limiter: mockDraftRateLimitCheck,
        other: mockRateLimitCheck,
      },
      {
        route: 'POST /api/quotes/[id]/release',
        path: 'release' as const,
        service: mockReleaseQuoteRequest,
        body: undefined,
        limiter: mockRateLimitCheck,
        other: mockDraftRateLimitCheck,
      },
      {
        route: 'DELETE /api/quotes/[id]',
        path: 'delete' as const,
        service: mockDeleteQuoteRequest,
        body: undefined,
        limiter: mockDraftRateLimitCheck,
        other: mockRateLimitCheck,
        answer: { deleted: true },
      },
    ];

    describe('DELETE /api/quotes/[id]', () => {
      beforeEach(() => mockDeleteQuoteRequest.mockResolvedValue(undefined));

      it('deletes the draft in the path and says so', async () => {
        const result = await (await load('delete'))(withId);

        expect(mockDeleteQuoteRequest).toHaveBeenCalledWith(
          'draft-001',
          withId,
        );
        expect(result).toEqual({ deleted: true });
      });
    });

    beforeEach(() => {
      mockGetCartCookie.mockReturnValue('cart-abc');
      mockGetCart.mockResolvedValue({ id: 'cart-abc', items: [{ id: 'l1' }] });
    });

    // Draft writes have their own, wider limit: autosave writes once per
    // change, and an office shares one IP.
    describe.each(requestRoutes)(
      '$route',
      ({ path, service, body, limiter, other, answer }) => {
        beforeEach(() => {
          readBodyMock.mockReturnValue(body);
          service.mockResolvedValue(draft);
        });

        it('requires authentication and counts nothing without it', async () => {
          mockRequireAuth.mockRejectedValue(
            new Error('Authentication required'),
          );

          await expect((await load(path))(withId)).rejects.toThrow(
            'Authentication required',
          );
          expect(limiter).not.toHaveBeenCalled();
          expect(service).not.toHaveBeenCalled();
        });

        it('counts against its own limit only', async () => {
          await (
            await load(path)
          )(withId);

          expect(limiter).toHaveBeenCalledTimes(1);
          expect(other).not.toHaveBeenCalled();
        });

        it('answers 429 and never calls Geins when the limit is reached', async () => {
          limiter.mockResolvedValue({
            allowed: false,
            remaining: 0,
            resetTime: 0,
          });

          await expect((await load(path))(withId)).rejects.toMatchObject({
            statusCode: 429,
            message:
              limiter === mockDraftRateLimitCheck
                ? 'Too many quote draft changes'
                : 'Too many quote responses',
          });
          expect(service).not.toHaveBeenCalled();
        });

        it('keys the limit on the client IP and answers', async () => {
          const result = await (await load(path))(withId);

          expect(limiter).toHaveBeenCalledWith('203.0.113.7');
          expect(result).toEqual(answer ?? { quote: draft });
        });
      },
    );

    describe('POST /api/quotes/requests', () => {
      beforeEach(() => {
        readBodyMock.mockReturnValue({ name: '  Varukorg 2 nov 2026 ' });
        mockCreateQuoteRequest.mockResolvedValue(draft);
      });

      it('creates the draft from the cart in the cookie, never one the client names', async () => {
        readBodyMock.mockReturnValue({
          name: 'Varukorg 2 nov 2026',
          cartId: 'someone-elses-cart',
        });

        const handler = await load('create');
        await handler(mockEvent);

        expect(mockGetCart).toHaveBeenCalledWith('cart-abc', mockEvent);
        expect(mockCreateQuoteRequest).toHaveBeenCalledWith(
          'cart-abc',
          'Varukorg 2 nov 2026',
          mockEvent,
        );
      });

      it('trims the name', async () => {
        const handler = await load('create');
        await handler(mockEvent);

        expect(mockCreateQuoteRequest.mock.calls[0]![1]).toBe(
          'Varukorg 2 nov 2026',
        );
      });

      it('forgets the cart after Geins created the draft: the next add starts a new cart', async () => {
        const handler = await load('create');
        await handler(mockEvent);

        expect(mockForgetCart).toHaveBeenCalledWith(
          mockEvent,
          'auth-token-abc',
          'cart-abc',
        );
        expect(mockClearCartCookie).toHaveBeenCalledWith(mockEvent);
        expect(mockForgetCart.mock.invocationCallOrder[0]).toBeGreaterThan(
          mockCreateQuoteRequest.mock.invocationCallOrder[0]!,
        );
      });

      it('keeps the cart when Geins refuses', async () => {
        mockCreateQuoteRequest.mockRejectedValue(new Error('Cart not found.'));

        await expect((await load('create'))(mockEvent)).rejects.toThrow(
          'Cart not found.',
        );
        expect(mockForgetCart).not.toHaveBeenCalled();
        expect(mockClearCartCookie).not.toHaveBeenCalled();
      });

      it('refuses with EMPTY_CART and never calls Geins when there is no cart', async () => {
        mockGetCartCookie.mockReturnValue(undefined);

        await expect((await load('create'))(mockEvent)).rejects.toMatchObject({
          statusCode: 409,
          code: 'EMPTY_CART',
          message: 'No cart to request a quote for',
        });
        expect(mockGetCart).not.toHaveBeenCalled();
        expect(mockCreateQuoteRequest).not.toHaveBeenCalled();
      });

      it('refuses with EMPTY_CART and never calls Geins when the cart has no lines', async () => {
        mockGetCart.mockResolvedValue({ id: 'cart-abc', items: [] });

        await expect((await load('create'))(mockEvent)).rejects.toMatchObject({
          statusCode: 409,
          code: 'EMPTY_CART',
        });
        expect(createAppError).toHaveBeenCalledWith(
          'EMPTY_CART',
          'Cart has no items',
          { cartId: 'cart-abc' },
        );
        expect(mockCreateQuoteRequest).not.toHaveBeenCalled();
        expect(mockForgetCart).not.toHaveBeenCalled();
      });

      it('refuses with EMPTY_CART when the cart comes back without lines', async () => {
        mockGetCart.mockResolvedValue({ id: 'cart-abc' });

        await expect((await load('create'))(mockEvent)).rejects.toMatchObject({
          code: 'EMPTY_CART',
        });
        expect(mockCreateQuoteRequest).not.toHaveBeenCalled();
      });

      it('refuses with EMPTY_CART when the cart read answers no cart', async () => {
        mockGetCart.mockResolvedValue(null);

        await expect((await load('create'))(mockEvent)).rejects.toMatchObject({
          code: 'EMPTY_CART',
        });
        expect(mockCreateQuoteRequest).not.toHaveBeenCalled();
      });

      it('fails when the cart cannot be read, without calling Geins', async () => {
        mockGetCart.mockRejectedValue(new Error('cart read failed'));

        await expect((await load('create'))(mockEvent)).rejects.toThrow(
          'cart read failed',
        );
        expect(mockCreateQuoteRequest).not.toHaveBeenCalled();
      });

      it.each([
        ['missing', {}],
        ['blank', { name: '   ' }],
        ['over 80 characters', { name: 'x'.repeat(81) }],
      ])('refuses a %s name before reading the cart', async (_label, body) => {
        readBodyMock.mockReturnValue(body);

        await expect((await load('create'))(mockEvent)).rejects.toThrow();
        expect(mockGetCart).not.toHaveBeenCalled();
        expect(mockCreateQuoteRequest).not.toHaveBeenCalled();
      });

      // The cart button shows only when both are on; the route asks the same.
      describe('the quotes and quoteRequests switches', () => {
        const expectRefused = async (event: import('h3').H3Event) => {
          await expect((await load('create'))(event)).rejects.toMatchObject({
            statusCode: 403,
          });
          expect(mockRateLimitCheck).not.toHaveBeenCalled();
          expect(mockGetCart).not.toHaveBeenCalled();
          expect(mockCreateQuoteRequest).not.toHaveBeenCalled();
          expect(mockForgetCart).not.toHaveBeenCalled();
        };

        it('creates the request when quotes and quoteRequests are both enabled', async () => {
          const result = await (await load('create'))(eventOn(true, true));

          expect(mockCreateQuoteRequest).toHaveBeenCalled();
          expect(result).toEqual({ quote: draft });
        });

        it('answers 403 when quoteRequests is disabled and quotes is enabled', async () => {
          await expectRefused(eventOn(true, false));
        });

        it('answers 403 when quotes is disabled and quoteRequests is enabled', async () => {
          await expectRefused(eventOn(false, true));
        });

        it('answers 403 when quotes and quoteRequests are both disabled', async () => {
          await expectRefused(eventOn(false, false));
        });

        it('answers 403 when the tenant stores no quoteRequests', async () => {
          await expectRefused(eventOn(true, undefined));
        });

        it('lets the signed-in buyer through when quotes requires authentication', async () => {
          const event = eventOn(true, true);
          event.context.tenant.config!.features.quotes = {
            enabled: true,
            access: 'authenticated',
          };

          await expect((await load('create'))(event)).resolves.toEqual({
            quote: draft,
          });
        });

        it('checks the switches only after sign-in', async () => {
          mockRequireAuth.mockRejectedValue(
            new Error('Authentication required'),
          );

          await expect(
            (await load('create'))(eventOn(false, false)),
          ).rejects.toThrow('Authentication required');
        });
      });

      it('takes a name of exactly 80 characters', async () => {
        readBodyMock.mockReturnValue({ name: 'x'.repeat(80) });

        const handler = await load('create');
        await handler(mockEvent);

        expect(mockCreateQuoteRequest.mock.calls[0]![1]).toBe('x'.repeat(80));
      });
    });

    // An existing draft follows the same switches as making one.
    describe.each(requestRoutes.filter((r) => r.path !== 'create'))(
      '$route and the quotes and quoteRequests switches',
      ({ path, service, body, limiter, answer }) => {
        const on = (quotes?: boolean, quoteRequests?: boolean) => {
          const event = eventOn(quotes, quoteRequests);
          event.context.params = { id: 'draft-001' };
          return event;
        };

        beforeEach(() => {
          readBodyMock.mockReturnValue(body);
          service.mockResolvedValue(draft);
        });

        it.each([
          ['quoteRequests is disabled', true, false],
          ['quotes is disabled', false, true],
          ['both are disabled', false, false],
          ['the tenant stores no quoteRequests', true, undefined],
        ] as const)(
          'answers 403 before the body, the limit and Geins when %s',
          async (_, quotes, quoteRequests) => {
            await expect(
              (await load(path))(on(quotes, quoteRequests)),
            ).rejects.toMatchObject({ statusCode: 403 });
            expect(readBodyMock).not.toHaveBeenCalled();
            expect(limiter).not.toHaveBeenCalled();
            expect(service).not.toHaveBeenCalled();
          },
        );

        it('answers when both are enabled', async () => {
          await expect((await load(path))(on(true, true))).resolves.toEqual(
            answer ?? { quote: draft },
          );
        });

        it('checks the switches only after sign-in', async () => {
          mockRequireAuth.mockRejectedValue(
            new Error('Authentication required'),
          );

          await expect((await load(path))(on(false, false))).rejects.toThrow(
            'Authentication required',
          );
        });
      },
    );

    describe('PATCH /api/quotes/[id]/request', () => {
      beforeEach(() => mockUpdateQuoteRequest.mockResolvedValue(draft));

      it('passes only the request details on, for the quotation in the path', async () => {
        readBodyMock.mockReturnValue({
          comment: 'Leverans till lager B',
          desiredDeliveryDate: '2026-12-15',
          customerOrderNumber: ' PO-7781 ',
          customerReference: 'not passed on',
          goodsLabel: ' Lastbrygga B ',
        });

        const handler = await load('update');
        await handler(withId);

        expect(mockUpdateQuoteRequest).toHaveBeenCalledWith(
          'draft-001',
          {
            comment: 'Leverans till lager B',
            desiredDeliveryDate: '2026-12-15',
            customerOrderNumber: 'PO-7781',
            goodsLabel: 'Lastbrygga B',
          },
          withId,
        );
      });

      it('passes a new name, trimmed, and the lines on', async () => {
        const items = [
          { id: 'line-1', skuId: 501, quantity: 3 },
          { skuId: 502, quantity: 1 },
          {
            id: 'line-2',
            skuId: 503,
            quantity: 2,
            configurationId: 'cfg-1',
            message: 'Montering',
          },
        ];
        readBodyMock.mockReturnValue({ name: '  Kontor plan 3 ', items });

        const handler = await load('update');
        await handler(withId);

        expect(mockUpdateQuoteRequest).toHaveBeenCalledWith(
          'draft-001',
          { name: 'Kontor plan 3', items },
          withId,
        );
      });

      it('takes one line, 200 lines, and amounts of 1 and 9999', async () => {
        const many = Array.from({ length: 200 }, (_, i) => ({
          skuId: i + 1,
          quantity: i % 2 ? 1 : 9999,
        }));
        for (const items of [[{ skuId: 1, quantity: 1 }], many]) {
          readBodyMock.mockReturnValue({ items });
          await (
            await load('update')
          )(withId);
          expect(mockUpdateQuoteRequest).toHaveBeenLastCalledWith(
            'draft-001',
            { items },
            withId,
          );
        }
      });

      it('takes a name of 80 characters', async () => {
        readBodyMock.mockReturnValue({ name: 'n'.repeat(80) });

        await (
          await load('update')
        )(withId);

        expect(mockUpdateQuoteRequest).toHaveBeenCalledWith(
          'draft-001',
          { name: 'n'.repeat(80) },
          withId,
        );
      });

      it('takes an empty body as no changes', async () => {
        readBodyMock.mockReturnValue({});

        const handler = await load('update');
        await handler(withId);

        expect(mockUpdateQuoteRequest).toHaveBeenCalledWith(
          'draft-001',
          {},
          withId,
        );
      });

      it.each([
        ['a comment over 2000 characters', { comment: 'x'.repeat(2001) }],
        [
          'a PO number over 30 characters',
          { customerOrderNumber: 'x'.repeat(31) },
        ],
        ['a goods label over 500 characters', { goodsLabel: 'x'.repeat(501) }],
        ['a date in another format', { desiredDeliveryDate: '15/12/2026' }],
        ['a date that does not exist', { desiredDeliveryDate: '2026-02-30' }],
        ['a date with a time', { desiredDeliveryDate: '2026-12-15T10:00:00Z' }],
        ['an empty name', { name: '   ' }],
        ['an empty list of lines', { items: [] }],
        ['a name over 80 characters', { name: 'n'.repeat(81) }],
        [
          'more than 200 lines',
          {
            items: Array.from({ length: 201 }, (_, i) => ({
              skuId: i + 1,
              quantity: 1,
            })),
          },
        ],
        ['an amount of 0', { items: [{ skuId: 1, quantity: 0 }] }],
        ['an amount over 9999', { items: [{ skuId: 1, quantity: 10000 }] }],
        ['a part of an amount', { items: [{ skuId: 1, quantity: 1.5 }] }],
        ['a line without a sku', { items: [{ quantity: 1 }] }],
        ['a sku of 0', { items: [{ skuId: 0, quantity: 1 }] }],
        ['a part of a sku', { items: [{ skuId: 1.5, quantity: 1 }] }],
        [
          'a line id over 64 characters',
          { items: [{ id: 'i'.repeat(65), skuId: 1, quantity: 1 }] },
        ],
        [
          'a configuration id over 64 characters',
          {
            items: [{ skuId: 1, quantity: 1, configurationId: 'c'.repeat(65) }],
          },
        ],
        [
          'a line message over 500 characters',
          { items: [{ skuId: 1, quantity: 1, message: 'm'.repeat(501) }] },
        ],
      ])('refuses %s', async (_label, body) => {
        readBodyMock.mockReturnValue(body);

        await expect((await load('update'))(withId)).rejects.toThrow();
        expect(mockUpdateQuoteRequest).not.toHaveBeenCalled();
      });

      it('takes a comment of 2000, a PO number of 30 and a goods label of 500 characters', async () => {
        const body = {
          comment: 'x'.repeat(2000),
          customerOrderNumber: 'y'.repeat(30),
          goodsLabel: 'z'.repeat(500),
        };
        readBodyMock.mockReturnValue(body);

        const handler = await load('update');
        await handler(withId);

        expect(mockUpdateQuoteRequest).toHaveBeenCalledWith(
          'draft-001',
          body,
          withId,
        );
      });
    });

    describe('POST /api/quotes/[id]/release', () => {
      it('sends the quotation in the path without reading a body', async () => {
        mockReleaseQuoteRequest.mockResolvedValue({
          ...draft,
          status: 'requested',
        });

        const result = await (await load('release'))(withId);

        expect(mockReleaseQuoteRequest).toHaveBeenCalledWith(
          'draft-001',
          withId,
        );
        expect(readBodyMock).not.toHaveBeenCalled();
        expect(result).toEqual({ quote: { ...draft, status: 'requested' } });
      });
    });
  });
});
