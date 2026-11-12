import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Adding a product to a request draft, or to a new one, from the product page
// ---------------------------------------------------------------------------

const mockAddToDraft = vi.fn();
const mockCreateDraftWith = vi.fn();
const mockPlacePlainLine = vi.fn();
vi.mock('../../../server/services/quotes', () => ({
  addToDraft: (...args: unknown[]) => mockAddToDraft(...args),
  createDraftWith: (...args: unknown[]) => mockCreateDraftWith(...args),
  placePlainLine: (...args: unknown[]) => mockPlacePlainLine(...args),
}));

const mockGetCartCookie = vi.fn();
const mockSetCartCookie = vi.fn();
const mockClearCartCookie = vi.fn();
vi.stubGlobal('getCartCookie', mockGetCartCookie);
vi.stubGlobal('setCartCookie', mockSetCartCookie);
vi.stubGlobal('clearCartCookie', mockClearCartCookie);
// The shared quote request check reads the session itself.
vi.stubGlobal('getSessionToken', vi.fn().mockReturnValue('auth-token'));

const mockRequireAuth = vi.fn();
vi.stubGlobal('requireAuth', mockRequireAuth);
vi.mock('../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  optionalAuth: vi.fn(),
}));

const mockDraftRateLimitCheck = vi.fn();
vi.mock('../../../server/utils/rate-limiter', () => ({
  quoteDraftRateLimiter: {
    check: (...args: unknown[]) => mockDraftRateLimitCheck(...args),
  },
  getClientIp: vi.fn().mockReturnValue('203.0.113.7'),
}));

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) =>
    Object.assign(new Error(msg), {
      code,
      statusCode: code === 'RATE_LIMITED' ? 429 : 400,
    }),
  ),
);
vi.stubGlobal('ErrorCode', {
  RATE_LIMITED: 'RATE_LIMITED',
  BAD_REQUEST: 'BAD_REQUEST',
});
const readBodyMock = vi.fn();
vi.stubGlobal(
  'readValidatedBody',
  vi.fn(async (_event: unknown, validator: (raw: unknown) => unknown) =>
    validator(readBodyMock(_event)),
  ),
);
vi.stubGlobal(
  'getRouterParam',
  vi.fn(
    (event: { context: { params?: Record<string, string> } }, name: string) =>
      event.context.params?.[name],
  ),
);

const QUOTE_ID = '01a1cae6-ce08-7ea7-859d-4af6b1cb6832';
const QUOTE = { id: QUOTE_ID, name: 'Etapp 2', lineItems: [] };

/** An event on a tenant whose quotes and quoteRequests are as given. */
function eventOn(
  quotes: boolean | undefined,
  quoteRequests: boolean | undefined,
): H3Event {
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
      params: { id: QUOTE_ID },
    },
    node: { req: { headers: {} } },
  } as unknown as H3Event;
}

const ROUTES = {
  lines: () => import('../../../server/api/quotes/[id]/lines.post'),
  drafts: () => import('../../../server/api/quotes/drafts.post'),
} as const;

async function load(route: keyof typeof ROUTES) {
  return (await ROUTES[route]()).default as (event: H3Event) => unknown;
}

const BODIES = {
  lines: { skuId: 700, quantity: 3 },
  drafts: { name: '  Etapp 2 ', skuId: 700, quantity: 3 },
} as const;

describe('adding a product to a request draft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ authToken: 't' });
    mockDraftRateLimitCheck.mockResolvedValue({ allowed: true });
    mockAddToDraft.mockResolvedValue(QUOTE);
    mockCreateDraftWith.mockResolvedValue(QUOTE);
  });

  describe('POST /api/quotes/[id]/lines', () => {
    it('adds the SKU at its amount to the draft named in the path', async () => {
      readBodyMock.mockReturnValue(BODIES.lines);
      const event = eventOn(true, true);

      await expect((await load('lines'))(event)).resolves.toEqual({
        quote: QUOTE,
      });
      expect(mockAddToDraft).toHaveBeenCalledWith(
        QUOTE_ID,
        { skuId: 700, quantity: 3 },
        event,
      );
    });

    it('never sends a configuration the client names', async () => {
      readBodyMock.mockReturnValue({
        ...BODIES.lines,
        configurationId: 'someone-elses',
      });

      await (
        await load('lines')
      )(eventOn(true, true));

      expect(mockAddToDraft.mock.calls[0]![1]).toEqual({
        skuId: 700,
        quantity: 3,
      });
    });
  });

  describe('POST /api/quotes/drafts', () => {
    it('makes a draft with the trimmed name from a cart of its own holding the SKU', async () => {
      readBodyMock.mockReturnValue(BODIES.drafts);
      const event = eventOn(true, true);

      await expect((await load('drafts'))(event)).resolves.toEqual({
        quote: QUOTE,
      });
      expect(mockCreateDraftWith).toHaveBeenCalledWith(
        'Etapp 2',
        expect.any(Function),
        event,
      );

      const place = mockCreateDraftWith.mock.calls[0]![1] as (
        cartId: string,
      ) => Promise<unknown>;
      await place('separate-cart');
      expect(mockPlacePlainLine).toHaveBeenCalledWith(
        'separate-cart',
        { skuId: 700, quantity: 3 },
        event,
      );
    });

    it("never reads or changes the buyer's own cart", async () => {
      readBodyMock.mockReturnValue(BODIES.drafts);

      await (
        await load('drafts')
      )(eventOn(true, true));

      expect(mockGetCartCookie).not.toHaveBeenCalled();
      expect(mockSetCartCookie).not.toHaveBeenCalled();
      expect(mockClearCartCookie).not.toHaveBeenCalled();
    });

    it.each([
      ['no name', { skuId: 700, quantity: 1 }],
      ['a blank name', { name: '   ', skuId: 700, quantity: 1 }],
      ['a name too long', { name: 'x'.repeat(81), skuId: 700, quantity: 1 }],
    ])('answers 400 for %s', async (_case, body) => {
      readBodyMock.mockReturnValue(body);

      await expect(
        (await load('drafts'))(eventOn(true, true)),
      ).rejects.toThrow();
      expect(mockCreateDraftWith).not.toHaveBeenCalled();
    });
  });

  describe.each(['lines', 'drafts'] as const)(
    'POST %s, shared rules',
    (route) => {
      const service = () =>
        route === 'lines' ? mockAddToDraft : mockCreateDraftWith;

      beforeEach(() => {
        readBodyMock.mockReturnValue(BODIES[route]);
      });

      it('answers 401 for a buyer who is not signed in, reading nothing', async () => {
        mockRequireAuth.mockRejectedValue(
          Object.assign(new Error('auth'), { statusCode: 401 }),
        );

        await expect(
          (await load(route))(eventOn(true, true)),
        ).rejects.toMatchObject({ statusCode: 401 });
        expect(readBodyMock).not.toHaveBeenCalled();
        expect(service()).not.toHaveBeenCalled();
      });

      it.each([
        ['quoteRequests is disabled', true, false],
        ['quotes is disabled', false, true],
        ['both are disabled', false, false],
        ['the tenant stores no quoteRequests', true, undefined],
      ])(
        'answers 403 when %s, before the rate limit or the body',
        async (_case, quotes, quoteRequests) => {
          await expect(
            (await load(route))(eventOn(quotes, quoteRequests)),
          ).rejects.toMatchObject({ statusCode: 403 });
          expect(mockDraftRateLimitCheck).not.toHaveBeenCalled();
          expect(readBodyMock).not.toHaveBeenCalled();
          expect(service()).not.toHaveBeenCalled();
        },
      );

      it.each(['quotes', 'quoteRequests'] as const)(
        'lets the signed-in buyer through when %s requires authentication',
        async (feature) => {
          const event = eventOn(true, true);
          const features = (
            event.context as unknown as {
              tenant: { config: { features: Record<string, unknown> } };
            }
          ).tenant.config.features;
          features[feature] = { enabled: true, access: 'authenticated' };

          await expect((await load(route))(event)).resolves.toEqual({
            quote: QUOTE,
          });
        },
      );

      it('answers 429 when drafts change too often, reading nothing', async () => {
        mockDraftRateLimitCheck.mockResolvedValue({ allowed: false });

        await expect(
          (await load(route))(eventOn(true, true)),
        ).rejects.toMatchObject({ statusCode: 429 });
        expect(readBodyMock).not.toHaveBeenCalled();
        expect(service()).not.toHaveBeenCalled();
      });

      it.each([
        ['no SKU', { quantity: 1 }],
        [
          'a SKU that is not a positive whole number',
          { skuId: 0, quantity: 1 },
        ],
        ['no amount', { skuId: 700 }],
        ['an amount of 0', { skuId: 700, quantity: 0 }],
        [
          'an amount past the largest a line takes',
          { skuId: 700, quantity: 10000 },
        ],
        ['a fractional amount', { skuId: 700, quantity: 1.5 }],
      ])('answers 400 for %s', async (_case, line) => {
        readBodyMock.mockReturnValue(
          route === 'drafts' ? { name: 'Etapp 2', ...line } : line,
        );

        await expect(
          (await load(route))(eventOn(true, true)),
        ).rejects.toThrow();
        expect(service()).not.toHaveBeenCalled();
      });
    },
  );
});
