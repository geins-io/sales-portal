import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import { makeRawQuotationCart } from '../../fixtures/quote';

// ---------------------------------------------------------------------------
// Adding a product or a configuration to a request draft, or to a new one.
// ---------------------------------------------------------------------------

const mockGraphqlQuery = vi.fn();
const mockGraphqlMutation = vi.fn();

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    core: {
      geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se', tld: 'se' },
      graphql: { query: mockGraphqlQuery, mutation: mockGraphqlMutation },
    },
  }),
  buildRequestContext: vi.fn().mockReturnValue({
    languageId: 'sv-SE',
    marketId: 'se',
    userToken: 'test-user-token',
  }),
  getRequestChannelVariables: vi.fn().mockReturnValue({
    channelId: '1|se',
    languageId: 'sv-SE',
    marketId: 'se',
  }),
}));

vi.mock('../../../server/services/orders', () => ({
  findOrderPublicId: vi.fn().mockResolvedValue(undefined),
}));

const mockCreateCart = vi.fn();
const mockAddItem = vi.fn();
vi.mock('../../../server/services/cart', () => ({
  createCart: (...args: unknown[]) => mockCreateCart(...args),
  addItem: (...args: unknown[]) => mockAddItem(...args),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
}));
vi.mock('../../../server/services/graphql/unwrap', () => ({
  unwrapGraphQL: vi.fn((r: unknown) => {
    if (r === null || r === undefined) return r;
    if (typeof r !== 'object' || Array.isArray(r)) return r;
    const keys = Object.keys(r as Record<string, unknown>);
    if (keys.length === 1) return (r as Record<string, unknown>)[keys[0]!];
    return r;
  }),
}));

vi.stubGlobal(
  'wrapServiceCall',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => {
    const err = new Error(msg);
    (err as unknown as Record<string, unknown>).code = code;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  QUOTE_ADD_FAILED: 'QUOTE_ADD_FAILED',
  QUOTE_LINE_GONE: 'QUOTE_LINE_GONE',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
});

let service: typeof import('../../../server/services/quotes');

const mockEvent = {
  context: { tenant: { config: { channelSettings: { locales: ['sv-SE'] } } } },
} as unknown as H3Event;

type RawLine = Record<string, unknown>;

/** A plain line as Geins holds it. */
function plain(id: string, skuId: number, quantity: number): RawLine {
  return {
    id,
    skuId,
    quantity,
    product: { productId: skuId + 1000, name: `Product ${skuId}` },
  };
}

/** A configured line as Geins holds it. */
function configured(
  id: string,
  skuId: number,
  quantity: number,
  configurationId: string,
): RawLine {
  return {
    ...plain(id, skuId, quantity),
    configurationId,
    configuration: { summary: [], sections: [] },
  };
}

/** A quotation cart with these lines. */
function quotation(
  items: RawLine[],
  status = 'REQUEST_DRAFT',
  id = 'draft-001',
) {
  return {
    ...makeRawQuotationCart({ status, name: 'Etapp 2', modifiedAt: 'x' }),
    id,
    items,
  };
}

function draftHolds(items: RawLine[], status = 'REQUEST_DRAFT') {
  mockGraphqlQuery.mockResolvedValueOnce({
    getQuotationCart: quotation(items, status),
  });
}

function geinsAnswers(items: RawLine[]) {
  mockGraphqlMutation.mockResolvedValueOnce({
    updateQuotationRequest: quotation(items),
  });
}

/** The lines the update sent. */
function sentItems() {
  return mockGraphqlMutation.mock.calls[0]![0].variables.request.items;
}

describe('adding to a request draft', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    service = await import('../../../server/services/quotes');
  });

  describe('addToDraft, a plain product', () => {
    it('raises a plain line of the same SKU by the amount, keeping every other line as the draft holds it', async () => {
      draftHolds([
        configured('l1', 501, 2, 'cfg-1'),
        plain('l2', 700, 3),
        plain('l3', 800, 1),
      ]);
      geinsAnswers([
        configured('l1', 501, 2, 'cfg-1'),
        plain('l2', 700, 8),
        plain('l3', 800, 1),
      ]);

      const quote = await service.addToDraft(
        'draft-001',
        { skuId: 700, quantity: 5 },
        mockEvent,
      );

      expect(mockGraphqlMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: 'query:quotes/update-quotation-request.graphql',
          variables: {
            quotationId: 'draft-001',
            languageId: 'sv-SE',
            request: {
              items: [
                {
                  id: 'l1',
                  skuId: 501,
                  quantity: 2,
                  configurationId: 'cfg-1',
                },
                { id: 'l2', skuId: 700, quantity: 8 },
                { id: 'l3', skuId: 800, quantity: 1 },
              ],
            },
          },
        }),
      );
      expect(quote.id).toBe('draft-001');
    });

    it('appends a new line when the draft has the SKU only as a configured line', async () => {
      draftHolds([configured('l1', 700, 2, 'cfg-1')]);
      geinsAnswers([configured('l1', 700, 2, 'cfg-1'), plain('l2', 700, 1)]);

      await service.addToDraft(
        'draft-001',
        { skuId: 700, quantity: 1 },
        mockEvent,
      );

      expect(sentItems()).toEqual([
        { id: 'l1', skuId: 700, quantity: 2, configurationId: 'cfg-1' },
        { skuId: 700, quantity: 1 },
      ]);
    });

    it('stops a raised line at the largest amount a line takes', async () => {
      draftHolds([plain('l1', 700, 9990)]);
      geinsAnswers([plain('l1', 700, 9999)]);

      await service.addToDraft(
        'draft-001',
        { skuId: 700, quantity: 20 },
        mockEvent,
      );

      expect(sentItems()).toEqual([{ id: 'l1', skuId: 700, quantity: 9999 }]);
    });

    it('refuses, writing nothing, when the line already holds the largest amount', async () => {
      draftHolds([plain('l1', 700, 9999)]);

      await expect(
        service.addToDraft('draft-001', { skuId: 700, quantity: 1 }, mockEvent),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
      expect(mockGraphqlMutation).not.toHaveBeenCalled();
    });

    it('refuses, writing nothing, when the draft holds as many lines as one may', async () => {
      draftHolds(
        Array.from({ length: 200 }, (_, i) => plain(`l${i}`, 1 + i, 1)),
      );

      await expect(
        service.addToDraft('draft-001', { skuId: 999, quantity: 1 }, mockEvent),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
      expect(mockGraphqlMutation).not.toHaveBeenCalled();
    });

    it.each(['REQUESTED', 'PENDING'])(
      'refuses, writing nothing, when the quotation is %s and no longer a draft',
      async (status) => {
        draftHolds([plain('l1', 700, 1)], status);

        await expect(
          service.addToDraft(
            'draft-001',
            { skuId: 700, quantity: 1 },
            mockEvent,
          ),
        ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
        expect(mockGraphqlMutation).not.toHaveBeenCalled();
      },
    );

    it('refuses, writing nothing, when there is no such quotation', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: null });

      await expect(
        service.addToDraft('draft-001', { skuId: 700, quantity: 1 }, mockEvent),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
      expect(mockGraphqlMutation).not.toHaveBeenCalled();
    });

    it('fails when the answer does not hold the line at its new amount', async () => {
      draftHolds([plain('l1', 700, 3)]);
      // Geins dropped the change: the line is as it was.
      geinsAnswers([plain('l1', 700, 3)]);

      await expect(
        service.addToDraft('draft-001', { skuId: 700, quantity: 2 }, mockEvent),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
    });

    it('fails when the answer does not hold the appended line', async () => {
      draftHolds([plain('l1', 700, 3)]);
      geinsAnswers([plain('l1', 700, 3)]);

      await expect(
        service.addToDraft('draft-001', { skuId: 800, quantity: 1 }, mockEvent),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
    });

    it('refuses, writing nothing, a cart Geins answers without its quotation', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        getQuotationCart: { id: 'draft-001', items: [] },
      });

      await expect(
        service.addToDraft('draft-001', { skuId: 700, quantity: 1 }, mockEvent),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
      expect(mockGraphqlMutation).not.toHaveBeenCalled();
    });

    it('sends the line alone for a draft Geins answers without its lines', async () => {
      const cart: Record<string, unknown> = quotation([]);
      delete cart.items;
      mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });
      geinsAnswers([plain('l1', 700, 1)]);

      await service.addToDraft(
        'draft-001',
        { skuId: 700, quantity: 1 },
        mockEvent,
      );

      expect(sentItems()).toEqual([{ skuId: 700, quantity: 1 }]);
    });
  });

  describe('addToDraft, a configuration committed on the way', () => {
    const LINE = { skuId: 1534, quantity: 2, configurationId: 'cfg-new' };

    it('reads the draft before the commit, then appends the committed line to the list read after it', async () => {
      const commit = vi.fn(async () => LINE);
      draftHolds([plain('l1', 700, 1)]);
      // Changed meanwhile: the list after the commit is the one sent.
      draftHolds([plain('l1', 700, 4)]);
      geinsAnswers([plain('l1', 700, 4), configured('l2', 1534, 2, 'cfg-new')]);

      await service.addToDraft('draft-001', commit, mockEvent);

      expect(commit).toHaveBeenCalledOnce();
      expect(mockGraphqlQuery.mock.invocationCallOrder[0]).toBeLessThan(
        commit.mock.invocationCallOrder[0]!,
      );
      expect(sentItems()).toEqual([
        { id: 'l1', skuId: 700, quantity: 4 },
        { skuId: 1534, quantity: 2, configurationId: 'cfg-new' },
      ]);
    });

    it('appends a configured line even when the draft holds the same SKU', async () => {
      draftHolds([configured('l1', 1534, 1, 'cfg-1')]);
      draftHolds([configured('l1', 1534, 1, 'cfg-1')]);
      geinsAnswers([
        configured('l1', 1534, 1, 'cfg-1'),
        configured('l2', 1534, 2, 'cfg-new'),
      ]);

      await service.addToDraft('draft-001', async () => LINE, mockEvent);

      expect(sentItems()).toEqual([
        { id: 'l1', skuId: 1534, quantity: 1, configurationId: 'cfg-1' },
        LINE,
      ]);
    });

    it('commits nothing when the quotation is no longer a draft', async () => {
      const commit = vi.fn(async () => LINE);
      draftHolds([plain('l1', 700, 1)], 'REQUESTED');

      await expect(
        service.addToDraft('draft-001', commit, mockEvent),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
      expect(commit).not.toHaveBeenCalled();
    });

    it('fails when the answer does not hold the committed configuration', async () => {
      draftHolds([plain('l1', 700, 1)]);
      draftHolds([plain('l1', 700, 1)]);
      geinsAnswers([plain('l1', 700, 1)]);

      await expect(
        service.addToDraft('draft-001', async () => LINE, mockEvent),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
    });
  });

  describe('createDraftWith', () => {
    const LINE = { skuId: 700, quantity: 3 };

    beforeEach(() => {
      mockCreateCart.mockResolvedValue({ id: 'separate-cart' });
    });

    it('places the line in a cart of its own, then makes the draft from that cart', async () => {
      const place = vi.fn(async () => LINE);
      mockGraphqlMutation.mockResolvedValueOnce({
        createQuotationRequest: quotation([plain('l1', 700, 3)]),
      });

      const quote = await service.createDraftWith('Etapp 2', place, mockEvent);

      expect(mockCreateCart).toHaveBeenCalledWith(mockEvent);
      expect(place).toHaveBeenCalledWith('separate-cart');
      expect(mockGraphqlMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: 'query:quotes/create-quotation-request.graphql',
          variables: expect.objectContaining({
            request: { cartId: 'separate-cart', name: 'Etapp 2', draft: true },
          }),
        }),
      );
      expect(quote).toMatchObject({ id: 'draft-001', name: 'Etapp 2' });
    });

    it('makes no draft when the line could not be placed', async () => {
      const place = vi.fn(async () => {
        throw new Error('dropped');
      });

      await expect(
        service.createDraftWith('Etapp 2', place, mockEvent),
      ).rejects.toThrow('dropped');
      expect(mockGraphqlMutation).not.toHaveBeenCalled();
    });

    it('fails when the new draft does not hold the line', async () => {
      mockGraphqlMutation.mockResolvedValueOnce({
        createQuotationRequest: quotation([plain('l1', 800, 3)]),
      });

      await expect(
        service.createDraftWith('Etapp 2', async () => LINE, mockEvent),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
    });

    it('fails when the new draft holds the line at another amount', async () => {
      mockGraphqlMutation.mockResolvedValueOnce({
        createQuotationRequest: quotation([plain('l1', 700, 1)]),
      });

      await expect(
        service.createDraftWith('Etapp 2', async () => LINE, mockEvent),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
    });

    it('holds a configured line by its configuration', async () => {
      const line = { skuId: 1534, quantity: 1, configurationId: 'cfg-new' };
      mockGraphqlMutation.mockResolvedValueOnce({
        createQuotationRequest: quotation([
          configured('l1', 1534, 1, 'cfg-new'),
        ]),
      });

      await expect(
        service.createDraftWith('Etapp 2', async () => line, mockEvent),
      ).resolves.toMatchObject({ id: 'draft-001' });
    });
  });

  describe('placePlainLine', () => {
    it('adds the line to the cart and answers it', async () => {
      mockAddItem.mockResolvedValueOnce({
        items: [{ skuId: 700, quantity: 3 }],
      });

      await expect(
        service.placePlainLine(
          'separate-cart',
          { skuId: 700, quantity: 3 },
          mockEvent,
        ),
      ).resolves.toEqual({ skuId: 700, quantity: 3 });
      expect(mockAddItem).toHaveBeenCalledWith(
        'separate-cart',
        { skuId: 700, quantity: 3 },
        mockEvent,
      );
    });

    it.each([
      ['no cart at all', null],
      ['a cart without lines', {}],
      [
        'only another SKU at that amount',
        { items: [{ skuId: 800, quantity: 3 }] },
      ],
    ])('fails when Geins answers %s', async (_case, answer) => {
      mockAddItem.mockResolvedValueOnce(answer);

      await expect(
        service.placePlainLine(
          'separate-cart',
          { skuId: 700, quantity: 3 },
          mockEvent,
        ),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
    });

    // Geins answers a line short of stock with a 200 and no line.
    it('fails when the cart did not take the line', async () => {
      mockAddItem.mockResolvedValueOnce({ items: [] });

      await expect(
        service.placePlainLine(
          'separate-cart',
          { skuId: 700, quantity: 3 },
          mockEvent,
        ),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
    });

    it('fails when the cart took less than the amount', async () => {
      mockAddItem.mockResolvedValueOnce({
        items: [{ skuId: 700, quantity: 1 }],
      });

      await expect(
        service.placePlainLine(
          'separate-cart',
          { skuId: 700, quantity: 3 },
          mockEvent,
        ),
      ).rejects.toMatchObject({ code: 'QUOTE_ADD_FAILED' });
    });
  });

  describe('the draft list', () => {
    it('carries when each quotation was last changed', async () => {
      mockGraphqlQuery.mockResolvedValueOnce({
        listQuotationCarts: [
          {
            ...makeRawQuotationCart({
              status: 'REQUEST_DRAFT',
              modifiedAt: '2026-11-12T08:00:00Z',
            }),
            id: 'draft-001',
          },
          {
            ...makeRawQuotationCart({ status: 'REQUEST_DRAFT' }),
            id: 'draft-002',
            quotation: { status: 'REQUEST_DRAFT' },
          },
        ],
      });

      const { quotes } = await service.listQuotes('', 0, 10, mockEvent);

      expect(quotes.find((q) => q.id === 'draft-001')!.updatedAt).toBe(
        '2026-11-12T08:00:00Z',
      );
      expect(quotes.find((q) => q.id === 'draft-002')!.updatedAt).toBe('');
    });
  });
});
