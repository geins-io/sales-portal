import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommittedConfiguration } from '../../../../../shared/types/configurator';
import {
  CTX,
  backend,
  bodyReads,
  lifecycleCases,
  makeEvent,
  resetHarness,
  type RouteHandler,
} from './harness';

const addToDraft = vi.fn();
const createDraftWith = vi.fn();
vi.mock('../../../../../server/services/quotes', () => ({
  addToDraft: (...args: unknown[]) => addToDraft(...args),
  createDraftWith: (...args: unknown[]) => createDraftWith(...args),
}));

const addItem = vi.fn();
vi.mock('../../../../../server/services/cart', () => ({
  addItem: (...args: unknown[]) => addItem(...args),
}));

const rateLimitCheck = vi.fn();
vi.mock('../../../../../server/utils/rate-limiter', () => ({
  quoteDraftRateLimiter: {
    check: (...args: unknown[]) => rateLimitCheck(...args),
  },
  getClientIp: () => '203.0.113.7',
}));

// The tenant's quote switches; the real rule over them is the quote routes'.
const quoteSwitches = { quotes: true, quoteRequests: true };
const assertFeatureAccess = vi.fn();
vi.mock('../../../../../server/utils/feature-access', async (original) => ({
  ...(await original<object>()),
  assertFeatureAccess: (...args: unknown[]) => assertFeatureAccess(...args),
}));

const SESSION_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const QUOTE_ID = '01a1cae6-ce08-7ea7-859d-4af6b1cb6832';
const COMMITTED = {
  committedConfigurationId: '9c5b94b1-35ad-49bb-b118-8e8fc24abf80',
  configurationId: SESSION_ID,
  quantity: 2,
} as Partial<CommittedConfiguration> as CommittedConfiguration;
const LINE = {
  skuId: 1534,
  quantity: 2,
  configurationId: COMMITTED.committedConfigurationId,
};
const QUOTE = { id: QUOTE_ID, lineItems: [] };

function eventWith(body: unknown, init: Parameters<typeof makeEvent>[0] = {}) {
  return makeEvent({ id: SESSION_ID, body, ...init });
}

describe('POST /api/configurations/:id/quote-add', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    quoteSwitches.quotes = true;
    quoteSwitches.quoteRequests = true;
    assertFeatureAccess.mockImplementation(
      async (_event: unknown, name: 'quotes' | 'quoteRequests') => {
        if (!quoteSwitches[name]) {
          throw Object.assign(new Error('Access denied'), { statusCode: 403 });
        }
      },
    );
    rateLimitCheck.mockReset().mockResolvedValue({ allowed: true });
    backend.commit.mockResolvedValue(COMMITTED);
    backend.addToCart.mockResolvedValue({ itemId: 'item-1' });
    // The services run what they are handed, as the real ones do once the
    // draft has been checked or the separate cart made.
    addToDraft
      .mockReset()
      .mockImplementation(
        async (_quote: string, line: () => Promise<unknown>) => {
          await line();
          return QUOTE;
        },
      );
    createDraftWith
      .mockReset()
      .mockImplementation(
        async (_name: string, place: (cartId: string) => Promise<unknown>) => {
          await place('separate-cart');
          return QUOTE;
        },
      );
    handler = (
      await import('../../../../../server/api/configurations/[id]/quote-add.post')
    ).default;
  });

  describe('to a draft', () => {
    const BODY = { skuId: 1534, quoteId: QUOTE_ID };

    it("commits the session and appends the committed configuration, at the commit's amount", async () => {
      const event = eventWith(BODY);

      await expect(handler(event)).resolves.toEqual({ quote: QUOTE });

      expect(addToDraft).toHaveBeenCalledWith(
        QUOTE_ID,
        expect.any(Function),
        event,
      );
      expect(backend.commit).toHaveBeenCalledWith(SESSION_ID, CTX);
      const line = addToDraft.mock.calls[0]![1] as () => Promise<unknown>;
      backend.commit.mockClear();
      await expect(line()).resolves.toEqual(LINE);
    });

    it('commits nothing when the service refuses the draft', async () => {
      addToDraft.mockReset().mockRejectedValue(new Error('not a draft'));

      await expect(handler(eventWith(BODY))).rejects.toThrow();
      expect(backend.commit).not.toHaveBeenCalled();
    });

    it('makes no new draft', async () => {
      await handler(eventWith(BODY));

      expect(createDraftWith).not.toHaveBeenCalled();
    });
  });

  describe('to a new draft', () => {
    const BODY = { skuId: 1534, name: '  Etapp 2 ' };

    it('commits the session into a cart of its own and makes the draft from it', async () => {
      const event = eventWith(BODY);

      await expect(handler(event)).resolves.toEqual({ quote: QUOTE });

      expect(createDraftWith).toHaveBeenCalledWith(
        'Etapp 2',
        expect.any(Function),
        event,
      );
      expect(backend.commit).toHaveBeenCalledWith(SESSION_ID, CTX);
      expect(backend.addToCart).toHaveBeenCalledWith(
        'separate-cart',
        {
          committedConfigurationId: COMMITTED.committedConfigurationId,
          skuId: 1534,
          quantity: 2,
        },
        expect.objectContaining({ ...CTX, cart: expect.any(Object) }),
      );
      expect(addToDraft).not.toHaveBeenCalled();
    });

    it('adds a plain line the backend places through the cart service', async () => {
      await handler(eventWith(BODY));
      const ctx = backend.addToCart.mock.calls[0]![2] as {
        cart: { addPlainItem: (id: string, item: unknown) => unknown };
      };

      await ctx.cart.addPlainItem('separate-cart', { skuId: 1 });

      expect(addItem).toHaveBeenCalledWith(
        'separate-cart',
        { skuId: 1 },
        expect.anything(),
      );
    });
  });

  it.each([
    ['no SKU', { quoteId: QUOTE_ID }],
    ['neither a draft nor a name', { skuId: 1534 }],
    ['a draft id that is not a GUID', { skuId: 1534, quoteId: 'q-1' }],
    ['a blank name', { skuId: 1534, name: '  ' }],
    ['a name too long', { skuId: 1534, name: 'x'.repeat(81) }],
  ])('answers 400 for %s, committing nothing', async (_case, body) => {
    await expect(handler(eventWith(body))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(backend.commit).not.toHaveBeenCalled();
  });

  it.each([
    ['quoteRequests is disabled', true, false],
    ['quotes is disabled', false, true],
  ])(
    'answers 403 when %s, reading nothing and committing nothing',
    async (_case, quotes, quoteRequests) => {
      quoteSwitches.quotes = quotes;
      quoteSwitches.quoteRequests = quoteRequests;

      await expect(
        handler(eventWith({ skuId: 1534, quoteId: QUOTE_ID })),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(rateLimitCheck).not.toHaveBeenCalled();
      expect(bodyReads).not.toHaveBeenCalled();
      expect(backend.commit).not.toHaveBeenCalled();
    },
  );

  it('asks both switches as the signed-in buyer', async () => {
    const event = eventWith({ skuId: 1534, quoteId: QUOTE_ID });

    await handler(event);

    expect(assertFeatureAccess).toHaveBeenCalledWith(event, 'quotes', {
      authenticated: true,
    });
    expect(assertFeatureAccess).toHaveBeenCalledWith(event, 'quoteRequests', {
      authenticated: true,
    });
  });

  it('answers 429 when drafts change too often, reading nothing', async () => {
    rateLimitCheck.mockResolvedValue({ allowed: false });

    await expect(
      handler(eventWith({ skuId: 1534, quoteId: QUOTE_ID })),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(bodyReads).not.toHaveBeenCalled();
    expect(backend.commit).not.toHaveBeenCalled();
  });

  lifecycleCases({
    handler: () => handler,
    method: 'commit',
    event: (init) => eventWith({ skuId: 1534, quoteId: QUOTE_ID }, init),
    operation: 'configurator.addToQuote',
    result: COMMITTED,
  });
});
