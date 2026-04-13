import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external services at the SDK boundary
// ---------------------------------------------------------------------------
const mockGetCheckout = vi.fn();
const mockValidateOrder = vi.fn();
const mockCreateOrder = vi.fn();
const mockGetSummary = vi.fn();

vi.mock('../../../server/services/checkout', () => ({
  getCheckout: (...args: unknown[]) => mockGetCheckout(...args),
  validateOrder: (...args: unknown[]) => mockValidateOrder(...args),
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
  getSummary: (...args: unknown[]) => mockGetSummary(...args),
}));

const mockRequireAuth = vi.fn();
const mockOptionalAuth = vi.fn();
vi.mock('../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  optionalAuth: (...args: unknown[]) => mockOptionalAuth(...args),
}));

const mockRateLimitCheck = vi.fn();
vi.mock('../../../server/utils/rate-limiter', () => ({
  createOrderRateLimiter: {
    check: (...args: unknown[]) => mockRateLimitCheck(...args),
  },
  getClientIp: () => '127.0.0.1',
}));

// Stub Nitro auto-imports
vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('createAppError', (code: string, message?: string) => {
  const statusMap: Record<string, number> = {
    NOT_FOUND: 404,
    BAD_REQUEST: 400,
    RATE_LIMITED: 429,
    UNAUTHORIZED: 401,
  };
  const error = new Error(message || code) as Error & {
    statusCode: number;
    code: string;
  };
  error.statusCode = statusMap[code] || 500;
  (error as unknown as { code: string }).code = code;
  return error;
});
vi.stubGlobal('ErrorCode', {
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
});
vi.stubGlobal(
  'getValidatedQuery',
  async (_event: unknown, parseFn: (input: unknown) => unknown) => {
    const event = _event as { __query?: Record<string, unknown> };
    return parseFn(event.__query || {});
  },
);
vi.stubGlobal(
  'readValidatedBody',
  async (_event: unknown, parseFn: (input: unknown) => unknown) => {
    const event = _event as { __body?: Record<string, unknown> };
    return parseFn(event.__body || {});
  },
);
vi.stubGlobal(
  'defineEventHandler',
  (fn: (event: unknown) => Promise<unknown>) => fn,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockEvent(
  overrides: {
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
  } = {},
) {
  return {
    context: { tenant: { hostname: 'test.com' } },
    __query: overrides.query,
    __body: overrides.body,
    node: { req: { socket: { remoteAddress: '127.0.0.1' } } },
  } as unknown as import('h3').H3Event;
}

const AUTH_TOKENS = { authToken: 'tok', refreshToken: 'ref' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Checkout API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(AUTH_TOKENS);
    mockOptionalAuth.mockResolvedValue(null);
    mockRateLimitCheck.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetTime: Date.now() + 60000,
    });
  });

  // --- GET /api/checkout ---------------------------------------------------
  describe('GET /api/checkout', () => {
    let handler: (event: unknown) => Promise<unknown>;

    beforeEach(async () => {
      const mod = await import('../../../server/api/checkout/index.get');
      handler = mod.default;
    });

    it('returns checkout data for valid cartId', async () => {
      const checkoutData = {
        email: 'test@example.com',
        cart: { id: 'cart-1' },
        paymentOptions: [],
        shippingOptions: [],
      };
      mockGetCheckout.mockResolvedValue(checkoutData);

      const event = mockEvent({ query: { cartId: 'cart-1' } });
      const result = await handler(event);

      expect(mockRequireAuth).toHaveBeenCalledWith(event);
      expect(mockGetCheckout).toHaveBeenCalledWith({ cartId: 'cart-1' }, event);
      expect(result).toEqual(checkoutData);
    });

    it('throws NOT_FOUND when checkout is undefined', async () => {
      mockGetCheckout.mockResolvedValue(undefined);

      const event = mockEvent({ query: { cartId: 'cart-1' } });
      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // --- POST /api/checkout/validate -----------------------------------------
  describe('POST /api/checkout/validate', () => {
    let handler: (event: unknown) => Promise<unknown>;

    beforeEach(async () => {
      const mod = await import('../../../server/api/checkout/validate.post');
      handler = mod.default;
    });

    it('returns validation result', async () => {
      const validationResult = { isValid: true };
      mockValidateOrder.mockResolvedValue(validationResult);

      const event = mockEvent({
        body: { cartId: 'cart-1', email: 'test@example.com' },
      });
      const result = await handler(event);

      expect(mockRequireAuth).toHaveBeenCalledWith(event);
      expect(mockValidateOrder).toHaveBeenCalledWith(
        { cartId: 'cart-1', checkoutOptions: { email: 'test@example.com' } },
        event,
      );
      expect(result).toEqual(validationResult);
    });
  });

  // --- POST /api/checkout/create-order -------------------------------------
  describe('POST /api/checkout/create-order', () => {
    let handler: (event: unknown) => Promise<unknown>;

    const validBody = {
      cartId: 'cart-1',
      paymentId: 1,
      shippingId: 2,
      email: 'test@example.com',
      billingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        addressLine1: '123 Main St',
        city: 'Stockholm',
        country: 'SE',
        zip: '11122',
      },
    };

    beforeEach(async () => {
      const mod =
        await import('../../../server/api/checkout/create-order.post');
      handler = mod.default;
    });

    it('returns orderId on success', async () => {
      mockCreateOrder.mockResolvedValue({
        created: true,
        orderId: '123',
        publicId: 'pub-123',
      });

      const event = mockEvent({ body: validBody });
      const result = await handler(event);

      expect(mockRequireAuth).toHaveBeenCalledWith(event);
      expect(mockRateLimitCheck).toHaveBeenCalledWith('127.0.0.1');
      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          cartId: 'cart-1',
          checkoutOptions: expect.objectContaining({
            paymentId: 1,
            shippingId: 2,
            email: 'test@example.com',
          }),
        }),
        event,
      );
      expect(result).toEqual({ orderId: '123', publicId: 'pub-123' });
    });

    it('throws on failed creation', async () => {
      mockCreateOrder.mockResolvedValue({
        created: false,
        message: 'Stock unavailable',
      });

      const event = mockEvent({ body: validBody });
      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('respects rate limit', async () => {
      mockRateLimitCheck.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
      });

      const event = mockEvent({ body: validBody });
      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 429,
      });

      expect(mockCreateOrder).not.toHaveBeenCalled();
    });
  });

  // --- GET /api/checkout/summary -------------------------------------------
  describe('GET /api/checkout/summary', () => {
    let handler: (event: unknown) => Promise<unknown>;

    beforeEach(async () => {
      const mod = await import('../../../server/api/checkout/summary.get');
      handler = mod.default;
    });

    it('returns summary data for authenticated users', async () => {
      const summaryData = {
        htmlSnippet: '<div>Thanks</div>',
        order: { orderId: '123' },
      };
      mockGetSummary.mockResolvedValue(summaryData);

      const event = mockEvent({
        query: { orderId: '123', paymentMethod: 'card' },
      });
      const result = await handler(event);

      expect(mockOptionalAuth).toHaveBeenCalledWith(event);
      expect(mockGetSummary).toHaveBeenCalledWith(
        { orderId: '123', paymentMethod: 'card' },
        event,
      );
      expect(result).toEqual(summaryData);
    });

    it('returns summary data for guest checkout (no auth token)', async () => {
      mockOptionalAuth.mockResolvedValueOnce(null);
      mockGetSummary.mockResolvedValue({ order: { orderId: '123' } });

      const event = mockEvent({
        query: { orderId: '123', paymentMethod: 'card' },
      });
      await handler(event);

      expect(mockOptionalAuth).toHaveBeenCalledWith(event);
      expect(mockRequireAuth).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when summary is undefined', async () => {
      mockGetSummary.mockResolvedValue(undefined);

      const event = mockEvent({
        query: { orderId: '123', paymentMethod: 'card' },
      });
      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // --- Auth check across all routes ----------------------------------------
  describe('auth enforcement', () => {
    it('guarded routes propagate 401 from requireAuth; summary is open for guests', async () => {
      const authError = new Error('Unauthorized') as Error & {
        statusCode: number;
      };
      authError.statusCode = 401;
      mockRequireAuth.mockRejectedValue(authError);

      const [getCheckout, validate, createOrderMod] = await Promise.all([
        import('../../../server/api/checkout/index.get'),
        import('../../../server/api/checkout/validate.post'),
        import('../../../server/api/checkout/create-order.post'),
      ]);

      const event = mockEvent();

      await expect(getCheckout.default(event)).rejects.toMatchObject({
        statusCode: 401,
      });
      await expect(validate.default(event)).rejects.toMatchObject({
        statusCode: 401,
      });
      await expect(createOrderMod.default(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });
});
