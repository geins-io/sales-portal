import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// Mock checkout service
const mockCreateToken = vi.fn();
const mockGetCheckout = vi.fn();
vi.mock('../../../../server/services/checkout', () => ({
  createToken: (...args: unknown[]) => mockCreateToken(...args),
  getCheckout: (...args: unknown[]) => mockGetCheckout(...args),
}));

// Stub Nitro / h3 auto-imports
vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal(
  'readValidatedBody',
  vi.fn(async (_event: unknown, parseFn: (input: unknown) => unknown) => {
    const event = _event as { __body?: Record<string, unknown> };
    return parseFn(event.__body ?? {});
  }),
);
vi.stubGlobal(
  'getRequestURL',
  vi.fn(() => new URL('http://localhost:3000/se/sv/checkout')),
);
const mockCookies: Record<string, string | undefined> = {};
vi.stubGlobal(
  'getCookie',
  vi.fn((_event: unknown, name: string) => mockCookies[name]),
);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => {
    const err = new Error(msg) as Error & { statusCode: number; code: string };
    err.statusCode =
      code === 'UNAUTHORIZED' ? 401 : code === 'BAD_REQUEST' ? 400 : 500;
    err.code = code;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});
vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());

// Helpers
function makeMockEvent(
  opts: {
    body?: Record<string, unknown>;
    tenantConfig?: Record<string, unknown>;
  } = {},
) {
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
              background: 'oklch(1 0 0)',
              foreground: 'oklch(0.1 0 0)',
              card: 'oklch(1 0 0)',
              cardForeground: 'oklch(0.1 0 0)',
              border: 'oklch(0.9 0 0)',
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
  } as unknown as import('h3').H3Event;
}

describe('POST /api/checkout/token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(mockCookies)) mockCookies[k] = undefined;
    mockCookies.market = 'se';
    mockCookies.locale = 'sv';
    mockCreateToken.mockResolvedValue('sdk-generated-token-123');
    mockGetCheckout.mockResolvedValue({
      paymentOptions: [
        { id: 23, isDefault: true, isSelected: false },
        { id: 42, isDefault: false, isSelected: false },
      ],
      shippingOptions: [
        { id: 1, isDefault: true, isSelected: false },
        { id: 2, isDefault: false, isSelected: false },
      ],
    });
    (
      globalThis.readValidatedBody as ReturnType<typeof vi.fn>
    ).mockImplementation(
      async (_event: unknown, parseFn: (input: unknown) => unknown) => {
        const event = _event as { __body?: Record<string, unknown> };
        return parseFn(event.__body ?? {});
      },
    );
  });

  it('returns token and checkoutUrl on success', async () => {
    const event = makeMockEvent({ body: { cartId: 'cart-abc' } });
    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    const result = (await handler(event)) as {
      token: string;
      checkoutUrl: string;
    };

    expect(result.token).toBe('sdk-generated-token-123');
    expect(result.checkoutUrl).toBe(
      'https://checkout.geins.services/sdk-generated-token-123',
    );
  });

  it('calls SDK createToken with correct branding from tenant theme', async () => {
    const event = makeMockEvent({ body: { cartId: 'cart-brand' } });
    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    await handler(event);

    expect(mockCreateToken).toHaveBeenCalledTimes(1);
    const [options] = mockCreateToken.mock.calls[0] as [
      import('@geins/types').GenerateCheckoutTokenOptions,
    ];
    expect(options.cartId).toBe('cart-brand');
    expect(options.selectedPaymentMethodId).toBe(23);
    expect(options.selectedShippingMethodId).toBe(1);
    expect(options.branding?.title).toBe('Test Brand');
    expect(options.branding?.logo).toBe('https://example.com/logo.svg');
    expect(options.branding?.styles?.accent).toBe('oklch(0.5 0.2 200)');
    expect(options.branding?.styles?.background).toBe('oklch(1 0 0)');
    expect(options.branding?.styles?.radius).toBe('0.5rem');
  });

  it('sets redirect URLs with locale/market prefix from cookies', async () => {
    const event = makeMockEvent({ body: { cartId: 'cart-redirect' } });
    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    await handler(event);

    const [options] = mockCreateToken.mock.calls[0] as [
      import('@geins/types').GenerateCheckoutTokenOptions,
    ];
    expect(options.redirectUrls?.success).toBe(
      'http://localhost:3000/se/sv/order-confirmation',
    );
    expect(options.redirectUrls?.cancel).toBe(
      'http://localhost:3000/se/sv/cart',
    );
    expect(options.redirectUrls?.continue).toBe('http://localhost:3000/se/sv/');
  });

  it('does not send a terms URL in the redirect payload', async () => {
    const event = makeMockEvent({ body: { cartId: 'cart-no-terms' } });
    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    await handler(event);

    const [options] = mockCreateToken.mock.calls[0] as [
      import('@geins/types').GenerateCheckoutTokenOptions,
    ];
    expect(options.redirectUrls?.terms).toBeUndefined();
  });

  it('omits locale/market prefix when cookies are missing or invalid', async () => {
    mockCookies.market = undefined;
    mockCookies.locale = undefined;
    const event = makeMockEvent({ body: { cartId: 'cart-no-cookies' } });
    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    await handler(event);

    const [options] = mockCreateToken.mock.calls[0] as [
      import('@geins/types').GenerateCheckoutTokenOptions,
    ];
    expect(options.redirectUrls?.success).toBe(
      'http://localhost:3000/order-confirmation',
    );
    expect(options.redirectUrls?.cancel).toBe('http://localhost:3000/cart');
    expect(options.redirectUrls?.continue).toBe('http://localhost:3000/');
  });

  it('throws 400 when cartId is missing', async () => {
    const event = makeMockEvent({ body: {} });
    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    await expect(handler(event)).rejects.toThrow();
  });

  it('throws 400 when SDK returns undefined token', async () => {
    mockCreateToken.mockResolvedValue(undefined);
    const event = makeMockEvent({ body: { cartId: 'cart-fail' } });
    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('handles missing branding gracefully', async () => {
    const event = makeMockEvent({
      body: { cartId: 'cart-no-brand' },
      tenantConfig: {
        tenantId: 'test',
        checkoutMode: 'hosted',
        theme: { colors: {}, radius: null },
        branding: {},
      },
    });
    const { default: handler } =
      await import('../../../../server/api/checkout/token.post');
    const result = (await handler(event)) as {
      token: string;
      checkoutUrl: string;
    };
    expect(result.token).toBe('sdk-generated-token-123');
  });
});
