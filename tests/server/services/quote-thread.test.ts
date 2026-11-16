import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import type { QuoteThreadEntry } from '#shared/types/quote';

const mockGraphqlQuery = vi.fn();
const mockGraphqlMutation = vi.fn();
const CHANNEL = { channelId: '1|se', languageId: 'sv-SE', marketId: 'se' };
vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    core: {
      graphql: {
        query: (...a: unknown[]) => mockGraphqlQuery(...a),
        mutation: (...a: unknown[]) => mockGraphqlMutation(...a),
      },
    },
  }),
  buildRequestContext: vi.fn().mockReturnValue({ userToken: 'user-token' }),
  getRequestChannelVariables: vi.fn(() => CHANNEL),
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
}));

vi.stubGlobal('createAppError', (code: string, message: string) =>
  Object.assign(new Error(message), { code }),
);
vi.stubGlobal('ErrorCode', { EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR' });

const mockWrapServiceCall = vi.fn(
  async (fn: () => Promise<unknown>, _area: string) => fn(),
);
vi.stubGlobal('wrapServiceCall', mockWrapServiceCall);

const { buildQuoteThread, getQuoteThread, createQuoteMessage } =
  await import('../../../server/services/quote-thread');

type Message = Parameters<typeof buildQuoteThread>[0][number];

let ids = 0;
function message(overrides: Partial<Message> = {}): Message {
  ids += 1;
  return {
    id: `m-${ids}`,
    type: 'TO_CUSTOMER',
    authorName: 'Erik Sälj',
    message: 'Hej',
    timestamp: '2026-11-10T08:00:00Z',
    answerRef: null,
    tags: [],
    ...overrides,
  };
}

const statusTags = (action: string, from: string, to: string) => [
  { key: 'action', value: action },
  { key: 'statusFrom', value: from },
  { key: 'statusTo', value: to },
];

/** Each entry as one line: what a reader of the thread sees, in order. */
const lines = (entries: QuoteThreadEntry[]) =>
  entries.map((e) =>
    [e.at, e.side, e.event?.type ?? 'message', e.text ?? ''].join(' '),
  );

beforeEach(() => {
  vi.clearAllMocks();
  ids = 0;
});

describe('buildQuoteThread', () => {
  describe('the request comment', () => {
    it('shows the first buyer message as "sent the request", with its text', () => {
      const comment = message({
        type: 'FROM_CUSTOMER',
        authorName: 'Anna Berg',
        message: 'Leverans till lager 2',
        timestamp: '2026-11-12T10:22:07Z',
        tags: [{ key: 'customerOrderNumber', value: 'PO-1' }],
      });

      expect(buildQuoteThread([comment]).entries).toEqual([
        {
          id: comment.id,
          at: '2026-11-12T10:22:07Z',
          side: 'buyer',
          authorName: 'Anna Berg',
          text: 'Leverans till lager 2',
          event: {
            type: 'request_sent',
            from: 'request_draft',
            to: 'requested',
          },
        },
      ]);
    });

    it('shows an empty comment as the bare event, not counted', () => {
      const { entries, messageCount } = buildQuoteThread([
        message({ type: 'FROM_CUSTOMER', message: '' }),
      ]);

      expect(lines(entries)).toEqual([
        '2026-11-10T08:00:00Z buyer request_sent ',
      ]);
      expect(messageCount).toBe(0);
    });

    it('takes only the first buyer message as the comment', () => {
      const { entries } = buildQuoteThread([
        message({
          type: 'FROM_CUSTOMER',
          message: 'Förfrågan',
          timestamp: '2026-11-10T08:00:00Z',
        }),
        message({
          type: 'FROM_CUSTOMER',
          message: 'Till',
          timestamp: '2026-11-10T09:00:00Z',
        }),
      ]);

      expect(lines(entries)).toEqual([
        '2026-11-10T08:00:00Z buyer request_sent Förfrågan',
        '2026-11-10T09:00:00Z buyer message Till',
      ]);
    });

    it('finds the first buyer message by its time, whatever order Geins answers in', () => {
      const { entries } = buildQuoteThread([
        message({
          type: 'FROM_CUSTOMER',
          message: 'Senare',
          timestamp: '2026-11-10T09:00:00Z',
        }),
        message({
          type: 'FROM_CUSTOMER',
          message: 'Först',
          timestamp: '2026-11-10T08:00:00Z',
        }),
      ]);

      expect(lines(entries)).toEqual([
        '2026-11-10T08:00:00Z buyer request_sent Först',
        '2026-11-10T09:00:00Z buyer message Senare',
      ]);
    });

    it('takes the first given of two buyer messages at the same instant', () => {
      const { entries } = buildQuoteThread([
        message({ type: 'FROM_CUSTOMER', message: 'Ett' }),
        message({ type: 'FROM_CUSTOMER', message: 'Två' }),
      ]);

      expect(entries.map((e) => [e.event?.type, e.text])).toEqual([
        ['request_sent', 'Ett'],
        [undefined, 'Två'],
      ]);
    });

    it('takes a chat message as a message, never as the comment', () => {
      const { entries } = buildQuoteThread([
        message({
          type: 'FROM_CUSTOMER',
          message: 'Skrivet i tråden',
          tags: [{ key: 'source', value: 'chat' }],
        }),
      ]);

      expect(lines(entries)).toEqual([
        '2026-11-10T08:00:00Z buyer message Skrivet i tråden',
      ]);
    });

    it('takes a buyer message written with a status change as that change, never as the comment', () => {
      const { entries } = buildQuoteThread([
        message({
          type: 'FROM_CUSTOMER',
          message: 'Vi kör',
          tags: statusTags('accept', 'pending', 'accepted'),
        }),
      ]);

      expect(entries[0]!.event?.type).toBe('accepted');
    });

    it('takes no seller message as the comment', () => {
      const { entries } = buildQuoteThread([message()]);

      expect(lines(entries)).toEqual([
        '2026-11-10T08:00:00Z seller message Hej',
      ]);
    });
  });

  describe('a message written with a status change', () => {
    it('shows the event after its author, with the text under it', () => {
      const cancel = message({
        authorName: 'Sara Lind',
        message: 'Vi återkallar denna',
        timestamp: '2026-11-11T12:45:27Z',
        tags: statusTags('cancel', 'pending', 'canceled'),
      });

      const { entries, messageCount } = buildQuoteThread([cancel]);

      expect(entries).toEqual([
        {
          id: cancel.id,
          at: '2026-11-11T12:45:27Z',
          side: 'seller',
          authorName: 'Sara Lind',
          text: 'Vi återkallar denna',
          event: { type: 'canceled', from: 'pending', to: 'canceled' },
        },
      ]);
      expect(messageCount).toBe(1);
    });

    it('leaves out a status the buyer never sees', () => {
      const { entries } = buildQuoteThread([
        message({ tags: statusTags('send', 'draft', 'pending') }),
      ]);

      expect(entries[0]!.event).toEqual({ type: 'quote_sent', to: 'pending' });
    });

    it.each([
      ['TO_CUSTOMER', 'release', 'request_draft', 'requested', 'request_sent'],
      ['TO_CUSTOMER', 'send', 'requested', 'pending', 'quote_sent'],
      ['FROM_CUSTOMER', 'accept', 'pending', 'accepted', 'accepted'],
      ['TO_CUSTOMER', 'confirm', 'accepted', 'confirmed', 'confirmed'],
      ['FROM_CUSTOMER', 'reject', 'pending', 'rejected', 'declined'],
      ['FROM_CUSTOMER', 'reject', 'requested', 'rejected', 'withdrawn'],
      ['TO_CUSTOMER', 'reject', 'pending', 'rejected', 'quote_rejected'],
      ['TO_CUSTOMER', 'reject', 'requested', 'rejected', 'request_rejected'],
      ['TO_CUSTOMER', 'finalize', 'confirmed', 'finalized', 'ordered'],
      ['TO_CUSTOMER', 'cancel', 'pending', 'canceled', 'canceled'],
      ['TO_CUSTOMER', 'expire', 'pending', 'expired', 'expired'],
      ['TO_CUSTOMER', 'extend', 'expired', 'pending', 'extended'],
      ['TO_CUSTOMER', 'extend', 'pending', 'pending', 'extended'],
    ])(
      'reads a %s %s message (%s → %s) as %s',
      (type, action, from, to, event) => {
        const { entries } = buildQuoteThread([
          message({ type, tags: statusTags(action, from, to) }),
        ]);

        expect(entries[0]!.event?.type).toBe(event);
      },
    );

    it("keeps the request draft a buyer's release starts from", () => {
      const { entries } = buildQuoteThread([
        message({
          type: 'FROM_CUSTOMER',
          tags: statusTags('release', 'request_draft', 'requested'),
        }),
      ]);

      expect(entries[0]!.event).toEqual({
        type: 'request_sent',
        from: 'request_draft',
        to: 'requested',
      });
    });

    it('reads a message Geins sends without tags as a plain one', () => {
      const { entries } = buildQuoteThread([
        message({ type: 'FROM_CUSTOMER', tags: null }),
        message({ tags: null }),
      ]);

      expect(entries.map((e) => e.event?.type)).toEqual([
        'request_sent',
        undefined,
      ]);
    });

    it('reads action and status whatever their case', () => {
      const { entries } = buildQuoteThread([
        message({ tags: statusTags('Extend', 'EXPIRED', 'PENDING') }),
      ]);

      expect(entries[0]!.event).toEqual({
        type: 'extended',
        from: 'expired',
        to: 'pending',
      });
    });

    it('shows a message with a status the portal does not know as a plain message', () => {
      const { entries } = buildQuoteThread([
        message({ tags: statusTags('revise', 'pending', 'revised') }),
      ]);

      expect(entries[0]).toEqual({
        id: 'm-1',
        at: '2026-11-10T08:00:00Z',
        side: 'seller',
        authorName: 'Erik Sälj',
        text: 'Hej',
      });
    });

    it('needs all three tags to be a status change', () => {
      const { entries } = buildQuoteThread([
        message({
          tags: [
            { key: 'action', value: 'cancel' },
            { key: 'statusTo', value: 'canceled' },
          ],
        }),
        message({
          tags: [
            { key: 'statusFrom', value: 'pending' },
            { key: 'statusTo', value: 'canceled' },
          ],
        }),
        message({
          tags: [
            { key: 'action', value: 'cancel' },
            { key: 'statusFrom', value: 'pending' },
          ],
        }),
      ]);

      expect(entries.map((e) => e.event)).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    });

    it('shows a status change written without text as the bare event, not counted', () => {
      const { entries, messageCount } = buildQuoteThread([
        message({
          message: '  ',
          tags: statusTags('cancel', 'pending', 'canceled'),
        }),
      ]);

      expect(entries[0]).not.toHaveProperty('text');
      expect(entries[0]!.event?.type).toBe('canceled');
      expect(messageCount).toBe(0);
    });
  });

  describe('messages', () => {
    it('places the buyer and the seller by type, oldest first', () => {
      const { entries } = buildQuoteThread([
        message({ message: 'Svar', timestamp: '2026-11-10T08:30:00Z' }),
        message({
          type: 'FROM_CUSTOMER',
          authorName: 'Anna Berg',
          message: 'Fråga',
          // 08:00 at +01:00 is 07:00 UTC: before the answer.
          timestamp: '2026-11-10T08:00:00+01:00',
          tags: [{ key: 'source', value: 'chat' }],
        }),
      ]);

      expect(entries).toEqual([
        {
          id: 'm-2',
          at: '2026-11-10T08:00:00+01:00',
          side: 'buyer',
          authorName: 'Anna Berg',
          text: 'Fråga',
        },
        {
          id: 'm-1',
          at: '2026-11-10T08:30:00Z',
          side: 'seller',
          authorName: 'Erik Sälj',
          text: 'Svar',
        },
      ]);
    });

    it('keeps messages of the same instant in the order Geins gave them', () => {
      const { entries } = buildQuoteThread([
        message({ message: 'Ett' }),
        message({ message: 'Två' }),
        message({ message: 'Tre' }),
      ]);

      expect(entries.map((e) => e.text)).toEqual(['Ett', 'Två', 'Tre']);
    });

    it('leaves the name out when Geins gives none', () => {
      const { entries } = buildQuoteThread([
        message({ authorName: '' }),
        message({ authorName: null }),
      ]);

      expect(entries[0]).not.toHaveProperty('authorName');
      expect(entries[1]).not.toHaveProperty('authorName');
    });

    it('drops an empty message', () => {
      const { entries } = buildQuoteThread([
        message({ message: '' }),
        message({ message: null }),
        message({ message: ' \n ' }),
      ]);

      expect(entries).toEqual([]);
    });

    it('keeps the text as written, lines and all', () => {
      const { entries } = buildQuoteThread([
        message({ message: '  Hej!\n\nMvh\n' }),
      ]);

      expect(entries[0]!.text).toBe('  Hej!\n\nMvh\n');
    });

    it('shows the message a reply answers', () => {
      const question = message({
        type: 'FROM_CUSTOMER',
        authorName: 'Anna Berg',
        message: 'Kan ni leverera i gult?',
        timestamp: '2026-11-10T08:00:00Z',
        tags: [{ key: 'source', value: 'chat' }],
      });
      const answer = message({
        message: 'Ja',
        timestamp: '2026-11-10T09:00:00Z',
        answerRef: question.id,
      });

      const { entries } = buildQuoteThread([question, answer]);

      expect(entries[1]!.replyTo).toEqual({
        authorName: 'Anna Berg',
        text: 'Kan ni leverera i gult?',
      });
      expect(entries[0]).not.toHaveProperty('replyTo');
    });

    it('quotes an answered message that has no text or name by what it has', () => {
      const comment = message({
        type: 'FROM_CUSTOMER',
        authorName: null,
        message: '',
      });
      const answer = message({ answerRef: comment.id });

      const { entries } = buildQuoteThread([comment, answer]);

      expect(entries[1]!.replyTo).toEqual({});
    });

    it('shows no quote when the answered message is gone', () => {
      const { entries } = buildQuoteThread([message({ answerRef: 'deleted' })]);

      expect(entries[0]).not.toHaveProperty('replyTo');
    });

    it('leaves out a message of a type the buyer is not meant to see', () => {
      const { entries } = buildQuoteThread([message({ type: 'INTERNAL' })]);

      expect(entries).toEqual([]);
    });

    it('counts the entries with text: messages and events written with one', () => {
      const { messageCount } = buildQuoteThread([
        message({ type: 'FROM_CUSTOMER', message: 'meddelande test' }),
        message({
          message: 'Vi återkallar denna',
          tags: statusTags('cancel', 'pending', 'canceled'),
        }),
        message({
          message: '',
          tags: statusTags('send', 'requested', 'pending'),
        }),
      ]);

      expect(messageCount).toBe(2);
    });

    it('answers an empty thread for no messages', () => {
      expect(buildQuoteThread([])).toEqual({ entries: [], messageCount: 0 });
    });
  });
});

describe('getQuoteThread', () => {
  const event = {} as H3Event;

  it("reads the quotation's messages as the buyer, and builds the thread", async () => {
    mockGraphqlQuery.mockResolvedValue({
      getQuotationMessages: [message({ message: 'Hej' })],
    });

    const thread = await getQuoteThread('q-1', event);

    expect(mockGraphqlQuery).toHaveBeenCalledWith({
      queryAsString: 'query:quotes/quotation-messages.graphql',
      variables: { quotationId: 'q-1' },
      userToken: 'user-token',
    });
    expect(mockWrapServiceCall.mock.calls[0]?.[1]).toBe('quotes');
    expect(lines(thread.entries)).toEqual([
      '2026-11-10T08:00:00Z seller message Hej',
    ]);
    expect(thread.messageCount).toBe(1);
  });

  it('asks without a user token when the request carries no context', async () => {
    const { buildRequestContext } =
      await import('../../../server/services/_sdk');
    vi.mocked(buildRequestContext).mockReturnValueOnce(undefined);
    mockGraphqlQuery.mockResolvedValue({ getQuotationMessages: [] });

    await getQuoteThread('q-1', event);

    expect(mockGraphqlQuery).toHaveBeenCalledWith(
      expect.objectContaining({ userToken: undefined }),
    );
  });

  it('answers an empty thread when Geins answers no messages', async () => {
    mockGraphqlQuery.mockResolvedValue({ getQuotationMessages: null });

    expect(await getQuoteThread('q-1', event)).toEqual({
      entries: [],
      messageCount: 0,
    });
  });

  it('fails when the messages cannot be read', async () => {
    mockGraphqlQuery.mockRejectedValue(new Error('enum'));

    await expect(getQuoteThread('q-1', event)).rejects.toThrow('enum');
  });
});

describe('createQuoteMessage', () => {
  const event = {} as H3Event;
  const PARENT = '3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f';

  beforeEach(() => {
    mockGraphqlMutation.mockResolvedValue({
      createQuotationMessage: message({ id: 'm-new', type: 'FROM_CUSTOMER' }),
    });
  });

  it('writes the message as the buyer and answers its id', async () => {
    const created = await createQuoteMessage('q-1', { message: 'Hej' }, event);

    expect(mockGraphqlMutation).toHaveBeenCalledWith({
      queryAsString: 'query:quotes/create-quotation-message.graphql',
      variables: { quotationId: 'q-1', message: 'Hej', ...CHANNEL },
      userToken: 'user-token',
      // A message Geins saves after a cut would read as failed and be sent twice.
      requestOptions: { context: { timeoutMs: 0 } },
    });
    expect(mockWrapServiceCall.mock.calls[0]?.[1]).toBe('quotes');
    expect(created).toEqual({ id: 'm-new' });
  });

  it('names the message it answers', async () => {
    await createQuoteMessage(
      'q-1',
      { message: 'Ja', answerRef: PARENT },
      event,
    );

    expect(mockGraphqlMutation.mock.calls[0]?.[0].variables).toEqual({
      quotationId: 'q-1',
      message: 'Ja',
      answerRef: PARENT,
      ...CHANNEL,
    });
  });

  it('writes without a user token when the request carries no context', async () => {
    const { buildRequestContext } =
      await import('../../../server/services/_sdk');
    vi.mocked(buildRequestContext).mockReturnValueOnce(undefined);

    await createQuoteMessage('q-1', { message: 'Hej' }, event);

    expect(mockGraphqlMutation).toHaveBeenCalledWith(
      expect.objectContaining({ userToken: undefined }),
    );
  });

  it('fails when Geins answers no message', async () => {
    mockGraphqlMutation.mockResolvedValue({ createQuotationMessage: null });

    await expect(
      createQuoteMessage('q-1', { message: 'Hej' }, event),
    ).rejects.toMatchObject({
      code: 'EXTERNAL_API_ERROR',
      message: 'Geins answered no message for quote q-1',
    });
  });

  it('fails when Geins refuses the message', async () => {
    mockGraphqlMutation.mockRejectedValue(new Error('not found'));

    await expect(
      createQuoteMessage('q-1', { message: 'Ja', answerRef: PARENT }, event),
    ).rejects.toThrow('not found');
  });
});
