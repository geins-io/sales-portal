import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock requireAuth — external session/cookie reads
// ---------------------------------------------------------------------------
const mockRequireAuth = vi.fn();
vi.mock('../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// ---------------------------------------------------------------------------
// Stub Nitro / h3 auto-imports
// ---------------------------------------------------------------------------
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal(
  'readValidatedBody',
  vi.fn(async (_event: unknown, parseFn: (input: unknown) => unknown) => {
    const event = _event as { __body?: Record<string, unknown> };
    return parseFn(event.__body ?? {});
  }),
);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => {
    const err = new Error(msg) as Error & { statusCode: number; code: string };
    const statusMap: Record<string, number> = {
      UNAUTHORIZED: 401,
      BAD_REQUEST: 400,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      INTERNAL_ERROR: 500,
    };
    err.statusCode = statusMap[code] ?? 400;
    err.code = code;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});
vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type MockEventOptions = {
  body?: Record<string, unknown>;
  tenantConfig?: Record<string, unknown>;
};

function makeMockEvent(opts: MockEventOptions = {}) {
  return {
    __body: opts.body,
    context: {
      tenant: {
        hostname: 'test.example.com',
        tenantId: 'test-tenant',
        config: opts.tenantConfig ?? {
          tenantId: 'test-tenant',
          hostname: 'test.example.com',
          checkoutMode: 'hosted',
          theme: {
            name: 'test-theme',
            colors: {
              primary: 'oklch(0.5 0.2 200)',
              primaryForeground: 'oklch(1 0 0)',
              secondary: 'oklch(0.8 0.1 150)',
              secondaryForeground: 'oklch(0.1 0 0)',
              background: 'oklch(1 0 0)',
              foreground: 'oklch(0.1 0 0)',
            },
            radius: '0.5rem',
          },
          branding: {
            name: 'Test Brand',
            watermark: 'full',
            logoUrl: 'https://example.com/logo.svg',
          },
        },
      },
    },
    node: { req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } } },
  } as unknown as import('h3').H3Event;
}

const AUTH_TOKENS = { authToken: 'auth-tok', refreshToken: 'refresh-tok' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/checkout/token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(AUTH_TOKENS);
    // Restore readValidatedBody stub after clearAllMocks resets it
    (
      globalThis.readValidatedBody as ReturnType<typeof vi.fn>
    ).mockImplementation(
      async (_event: unknown, parseFn: (input: unknown) => unknown) => {
        const event = _event as { __body?: Record<string, unknown> };
        return parseFn(event.__body ?? {});
      },
    );
  });

  it('returns a token and checkoutUrl for valid cartId', async () => {
    const event = makeMockEvent({ body: { cartId: 'cart-abc-123' } });

    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    const result = (await handler(event)) as {
      token: string;
      checkoutUrl: string;
    };

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('checkoutUrl');
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
    expect(result.checkoutUrl).toContain('cart-abc-123');
  });

  it('requires authentication — throws 401 without auth', async () => {
    mockRequireAuth.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
    );

    const event = makeMockEvent({ body: { cartId: 'cart-abc-123' } });

    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 400 when cartId is missing', async () => {
    const event = makeMockEvent({ body: {} });

    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    await expect(handler(event)).rejects.toThrow();
  });

  it('throws 400 when cartId is empty string', async () => {
    const event = makeMockEvent({ body: { cartId: '' } });

    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    await expect(handler(event)).rejects.toThrow();
  });

  it('includes tenant branding styles in the token payload', async () => {
    const event = makeMockEvent({ body: { cartId: 'cart-xyz' } });

    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    const result = (await handler(event)) as {
      token: string;
      checkoutUrl: string;
    };

    // Decode the token to verify branding is embedded
    const parts = result.token.split('.');
    expect(parts.length).toBe(3);
    const payload = JSON.parse(atob(parts[1]));
    expect(payload).toHaveProperty('branding');
    expect(payload.branding).toHaveProperty('primaryColor');
    expect(payload.branding.primaryColor).toBe('oklch(0.5 0.2 200)');
  });

  it('checkoutUrl uses HOSTED_CHECKOUT_BASE_URL constant', async () => {
    const event = makeMockEvent({ body: { cartId: 'cart-url-test' } });

    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    const { HOSTED_CHECKOUT_BASE_URL } =
      await import('../../../../shared/constants/checkout');

    const result = (await handler(event)) as {
      token: string;
      checkoutUrl: string;
    };

    expect(result.checkoutUrl).toContain(HOSTED_CHECKOUT_BASE_URL);
  });

  it('token payload includes cartId and tenantId', async () => {
    const event = makeMockEvent({ body: { cartId: 'cart-payload-check' } });

    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    const result = (await handler(event)) as {
      token: string;
      checkoutUrl: string;
    };

    const parts = result.token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    expect(payload.cartId).toBe('cart-payload-check');
    expect(payload.tenantId).toBe('test-tenant');
  });

  it('token payload includes expiry', async () => {
    const event = makeMockEvent({ body: { cartId: 'cart-exp-check' } });

    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    const result = (await handler(event)) as {
      token: string;
      checkoutUrl: string;
    };

    const parts = result.token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    expect(payload).toHaveProperty('exp');
    expect(typeof payload.exp).toBe('number');
    // Token should expire in the future
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('branding maps background and foreground colors', async () => {
    const event = makeMockEvent({ body: { cartId: 'cart-colors' } });

    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    const result = (await handler(event)) as {
      token: string;
      checkoutUrl: string;
    };

    const parts = result.token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    expect(payload.branding).toHaveProperty('backgroundColor');
    expect(payload.branding).toHaveProperty('foregroundColor');
    expect(payload.branding.backgroundColor).toBe('oklch(1 0 0)');
    expect(payload.branding.foregroundColor).toBe('oklch(0.1 0 0)');
  });
});
