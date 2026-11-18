import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createError, type H3Event } from 'h3';
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

const mockGetQuote = vi.fn();
vi.mock('../../../server/services/quotes', () => ({
  getQuote: (...a: unknown[]) => mockGetQuote(...a),
}));

const mockLoggerWarn = vi.fn();
vi.mock('../../../server/utils/logger', () => ({
  logger: { warn: (...a: unknown[]) => mockLoggerWarn(...a) },
}));

vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => `query:${path}`),
}));

vi.stubGlobal('createAppError', (code: string, message: string) =>
  Object.assign(new Error(message), { code }),
);
vi.stubGlobal('ErrorCode', {
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
});

const mockWrapServiceCall = vi.fn(
  async (fn: () => Promise<unknown>, _area: string) => fn(),
);
vi.stubGlobal('wrapServiceCall', mockWrapServiceCall);

const {
  buildQuoteThread,
  getQuoteThread,
  createQuoteMessage,
  deleteQuoteMessage,
} = await import('../../../server/services/quote-thread');

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
  mockGetQuote.mockResolvedValue({ id: 'q-1' });
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
  describe('which messages the buyer may delete', () => {
    /** A chat message the buyer wrote, which Geins still lets them change. */
    const own = (overrides: Partial<Message> = {}) =>
      message({
        type: 'FROM_CUSTOMER',
        authorName: 'Anna Berg',
        editable: true,
        tags: [{ key: 'source', value: 'chat' }],
        ...overrides,
      });

    const deletable = (messages: Message[]) =>
      buildQuoteThread(messages)
        .entries.filter((e) => e.deletable)
        .map((e) => e.id);

    it('lets the buyer delete their last message', () => {
      expect(deletable([own({ id: 'mine' })])).toEqual(['mine']);
    });

    it('locks it once the seller writes after it, reply or not', () => {
      expect(
        deletable([
          own({ timestamp: '2026-11-10T08:00:00Z' }),
          message({ timestamp: '2026-11-10T09:00:00Z', answerRef: null }),
        ]),
      ).toEqual([]);
    });

    it('locks it once an event happens after it', () => {
      expect(
        deletable([
          own({ timestamp: '2026-11-10T08:00:00Z' }),
          message({
            timestamp: '2026-11-10T09:00:00Z',
            message: null,
            tags: statusTags('extend', 'PENDING', 'PENDING'),
          }),
        ]),
      ).toEqual([]);
    });

    it("locks it once the buyer's own status change follows", () => {
      expect(
        deletable([
          own({ timestamp: '2026-11-10T08:00:00Z' }),
          own({
            timestamp: '2026-11-10T09:00:00Z',
            editable: false,
            tags: statusTags('accept', 'PENDING', 'ACCEPTED'),
          }),
        ]),
      ).toEqual([]);
    });

    it('lets the buyer delete two messages in a row', () => {
      expect(
        deletable([
          message({ timestamp: '2026-11-10T07:00:00Z' }),
          own({ id: 'first', timestamp: '2026-11-10T08:00:00Z' }),
          own({ id: 'second', timestamp: '2026-11-10T09:00:00Z' }),
        ]),
      ).toEqual(['first', 'second']);
    });

    it('reads "after" by time, whatever order Geins answers in', () => {
      expect(
        deletable([
          message({ timestamp: '2026-11-10T09:00:00Z' }),
          own({ id: 'mine', timestamp: '2026-11-10T08:00:00Z' }),
          own({ id: 'latest', timestamp: '2026-11-10T10:00:00Z' }),
        ]),
      ).toEqual(['latest']);
    });

    it('keeps a message Geins no longer lets the buyer change', () => {
      expect(deletable([own({ editable: false })])).toEqual([]);
      expect(deletable([own({ editable: null })])).toEqual([]);
      expect(deletable([own({ editable: undefined })])).toEqual([]);
    });

    it("never offers the seller's messages", () => {
      expect(deletable([message({ editable: true })])).toEqual([]);
    });

    it('never offers the request comment or a status change', () => {
      expect(deletable([own({ tags: [] })])).toEqual([]);
      expect(
        deletable([own({ tags: statusTags('accept', 'PENDING', 'ACCEPTED') })]),
      ).toEqual([]);
    });
  });
});

describe('buildQuoteThread with the status history', () => {
  type Quotation = NonNullable<Parameters<typeof buildQuoteThread>[1]>;
  type Change = NonNullable<Quotation['statusHistory']>[number];

  function change(
    action: string,
    statusFrom: string | null,
    statusTo: string,
    actor: string,
    timestamp: string,
    quotationNumber = '2611-2-0001-01',
  ): Change {
    return { timestamp, action, statusFrom, statusTo, actor, quotationNumber };
  }

  function quotation(
    statusHistory: Change[],
    overrides: Partial<Quotation> = {},
  ): Quotation {
    return {
      orderId: null,
      customer: { firstName: 'Anna', lastName: 'Berg' },
      statusHistory,
      ...overrides,
    };
  }

  /** Each entry as the log reads it: when, which side, who, what, text. */
  const log = (entries: QuoteThreadEntry[]) =>
    entries.map((e) =>
      [
        e.at,
        e.side,
        e.authorName ?? '-',
        e.event?.type ?? 'message',
        e.text ?? '',
      ]
        .join(' ')
        .trim(),
    );

  it('shows a change nobody wrote anything with as an event, named after the buyer', () => {
    const { entries, messageCount } = buildQuoteThread(
      [],
      quotation([
        change(
          'accept',
          'PENDING',
          'ACCEPTED',
          'CUSTOMER',
          '2026-11-16T12:26:23Z',
        ),
      ]),
    );

    expect(entries).toEqual([
      {
        id: expect.stringMatching(/^history-/),
        at: '2026-11-16T12:26:23Z',
        side: 'buyer',
        authorName: 'Anna Berg',
        event: { type: 'accepted', from: 'pending', to: 'accepted' },
      },
    ]);
    expect(messageCount).toBe(0);
  });

  it("names a seller's change by the side alone, never a person", () => {
    const { entries } = buildQuoteThread(
      [],
      quotation([
        change(
          'cancel',
          'PENDING',
          'CANCELED',
          'SELLER',
          '2026-11-16T12:00:00Z',
        ),
      ]),
    );

    expect(log(entries)).toEqual(['2026-11-16T12:00:00Z seller - canceled']);
  });

  it("merges a seller's message written with the change into one entry, by its writer", () => {
    const at = '2026-11-16T13:14:25.9840713+00:00';
    const sent = message({
      authorName: 'Sara Lind',
      message: 'Här är offerten',
      timestamp: at,
      tags: statusTags('send', 'draft', 'pending'),
    });

    const { entries, messageCount } = buildQuoteThread(
      [sent],
      quotation([change('send', 'DRAFT', 'PENDING', 'SELLER', at)]),
    );

    expect(entries).toEqual([
      {
        id: sent.id,
        at,
        side: 'seller',
        authorName: 'Sara Lind',
        text: 'Här är offerten',
        event: { type: 'quote_sent', to: 'pending' },
      },
    ]);
    expect(messageCount).toBe(1);
  });

  it("merges a buyer's message written with the change alike", () => {
    const at = '2026-11-16T12:26:23.7906951+00:00';
    const accepted = message({
      type: 'FROM_CUSTOMER',
      authorName: 'Lisa Ek',
      message: 'Vi kör',
      timestamp: at,
      tags: statusTags('accept', 'pending', 'accepted'),
    });

    const { entries } = buildQuoteThread(
      [accepted],
      quotation([change('accept', 'PENDING', 'ACCEPTED', 'CUSTOMER', at)]),
    );

    expect(log(entries)).toEqual([`${at} buyer Lisa Ek accepted Vi kör`]);
    expect(entries[0]!.id).toBe(accepted.id);
  });

  it('keeps a message and a change apart at another instant or another status', () => {
    const accepted = message({
      type: 'FROM_CUSTOMER',
      authorName: 'Lisa Ek',
      timestamp: '2026-11-16T12:26:23.000Z',
      tags: statusTags('accept', 'pending', 'accepted'),
    });

    const { entries } = buildQuoteThread(
      [accepted],
      quotation([
        change(
          'accept',
          'PENDING',
          'ACCEPTED',
          'CUSTOMER',
          '2026-11-16T12:26:23.001Z',
        ),
        change(
          'reject',
          'PENDING',
          'REJECTED',
          'CUSTOMER',
          '2026-11-16T12:26:23.000Z',
        ),
      ]),
    );

    expect(log(entries)).toEqual([
      '2026-11-16T12:26:23.000Z buyer Lisa Ek accepted Hej',
      '2026-11-16T12:26:23.000Z buyer Anna Berg declined',
      '2026-11-16T12:26:23.001Z buyer Anna Berg accepted',
    ]);
  });

  it('merges one change into one message only', () => {
    const at = '2026-11-16T12:26:23Z';
    const tagged = (text: string) =>
      message({
        type: 'FROM_CUSTOMER',
        message: text,
        timestamp: at,
        tags: statusTags('accept', 'pending', 'accepted'),
      });

    const { entries } = buildQuoteThread(
      [tagged('ett'), tagged('två')],
      quotation([change('accept', 'PENDING', 'ACCEPTED', 'CUSTOMER', at)]),
    );

    expect(entries.map((e) => e.text)).toEqual(['ett', 'två']);
    expect(entries.every((e) => e.event?.type === 'accepted')).toBe(true);
  });

  describe('a new version', () => {
    it('names the seller\'s answer to a request "sent the quotation", the revise not on its own', () => {
      const { entries } = buildQuoteThread(
        [],
        quotation([
          change(
            'release',
            'REQUEST_DRAFT',
            'REQUESTED',
            'CUSTOMER',
            '2026-11-16T08:55:22Z',
            '2611-2-0503-00',
          ),
          change(
            'revise',
            'REQUESTED',
            'REVISED',
            'SELLER',
            '2026-11-16T12:52:43.5Z',
            '2611-2-0503-00',
          ),
          change(
            'send',
            'DRAFT',
            'PENDING',
            'SELLER',
            '2026-11-16T12:52:43.7Z',
            '2611-2-0503-01',
          ),
        ]),
      );

      expect(log(entries)).toEqual([
        '2026-11-16T08:55:22Z buyer Anna Berg request_sent',
        '2026-11-16T12:52:43.7Z seller - quote_sent',
      ]);
      expect(entries[1]!.event).toEqual({
        type: 'quote_sent',
        from: 'requested',
        to: 'pending',
      });
    });

    it('names the send after a revise of a sent quotation "sent a new version"', () => {
      const { entries } = buildQuoteThread(
        [],
        quotation([
          change(
            'send',
            'DRAFT',
            'PENDING',
            'SELLER',
            '2026-11-16T10:00:00Z',
            '2611-2-0001-00',
          ),
          change(
            'revise',
            'PENDING',
            'REVISED',
            'SELLER',
            '2026-11-16T11:00:00.1Z',
            '2611-2-0001-00',
          ),
          change(
            'send',
            'DRAFT',
            'PENDING',
            'SELLER',
            '2026-11-16T11:00:00.2Z',
            '2611-2-0001-01',
          ),
          change(
            'send',
            'DRAFT',
            'PENDING',
            'SELLER',
            '2026-11-16T12:00:00Z',
            '2611-2-0001-02',
          ),
        ]),
      );

      expect(entries.map((e) => e.event)).toEqual([
        { type: 'quote_sent', to: 'pending' },
        { type: 'revision_sent', from: 'pending', to: 'pending' },
        { type: 'quote_sent', to: 'pending' },
      ]);
    });

    it("names the seller's message sent with a new version alike", () => {
      const at = '2026-11-16T11:00:00.2Z';
      const { entries } = buildQuoteThread(
        [
          message({
            message: 'Ny version med rabatt',
            timestamp: at,
            tags: statusTags('send', 'draft', 'pending'),
          }),
        ],
        quotation([
          change(
            'revise',
            'PENDING',
            'REVISED',
            'SELLER',
            '2026-11-16T11:00:00.1Z',
          ),
          change('send', 'DRAFT', 'PENDING', 'SELLER', at),
        ]),
      );

      expect(log(entries)).toEqual([
        `${at} seller Erik Sälj revision_sent Ny version med rabatt`,
      ]);
    });

    it('reads the history in time order, whatever order Geins answers in', () => {
      const { entries } = buildQuoteThread(
        [],
        quotation([
          change(
            'accept',
            'PENDING',
            'ACCEPTED',
            'CUSTOMER',
            '2026-11-16T13:00:00Z',
          ),
          change(
            'send',
            'DRAFT',
            'PENDING',
            'SELLER',
            '2026-11-16T12:00:00.2Z',
          ),
          change(
            'revise',
            'REQUESTED',
            'REVISED',
            'SELLER',
            '2026-11-16T12:00:00.1Z',
          ),
        ]),
      );

      expect(entries.map((e) => e.event)).toEqual([
        { type: 'quote_sent', from: 'requested', to: 'pending' },
        { type: 'accepted', from: 'pending', to: 'accepted' },
      ]);
    });

    it('waits for the send: another change between keeps its own name', () => {
      const { entries } = buildQuoteThread(
        [],
        quotation([
          change(
            'revise',
            'PENDING',
            'REVISED',
            'SELLER',
            '2026-11-16T12:00:00Z',
          ),
          change(
            'extend',
            'EXPIRED',
            'PENDING',
            'SELLER',
            '2026-11-16T12:01:00Z',
          ),
          change('send', 'DRAFT', 'PENDING', 'SELLER', '2026-11-16T12:02:00Z'),
        ]),
      );

      expect(entries.map((e) => e.event?.type)).toEqual([
        'extended',
        'revision_sent',
      ]);
    });

    it('names a new version also when Geins gives no status it was revised from', () => {
      const { entries } = buildQuoteThread(
        [],
        quotation([
          change('revise', null, 'REVISED', 'SELLER', '2026-11-16T12:00:00Z'),
          change('send', 'DRAFT', 'PENDING', 'SELLER', '2026-11-16T12:01:00Z'),
        ]),
      );

      expect(entries[0]!.event).toEqual({
        type: 'revision_sent',
        to: 'pending',
      });
    });

    it('leaves out a revise no send follows', () => {
      const { entries } = buildQuoteThread(
        [],
        quotation([
          change(
            'revise',
            'REQUESTED',
            'REVISED',
            'SELLER',
            '2026-11-16T11:00:00Z',
          ),
        ]),
      );

      expect(entries).toEqual([]);
    });
  });

  it('names an extension from its action', () => {
    const { entries } = buildQuoteThread(
      [],
      quotation([
        change(
          'extend',
          'EXPIRED',
          'PENDING',
          'SELLER',
          '2026-11-16T10:00:00Z',
        ),
      ]),
    );

    expect(entries[0]!.event).toEqual({
      type: 'extended',
      from: 'expired',
      to: 'pending',
    });
  });

  it('names an action it does not know from the new status', () => {
    const { entries } = buildQuoteThread(
      [],
      quotation([
        change(
          'approve',
          'PENDING',
          'ACCEPTED',
          'CUSTOMER',
          '2026-11-16T10:00:00Z',
        ),
      ]),
    );

    expect(log(entries)).toEqual([
      '2026-11-16T10:00:00Z buyer Anna Berg accepted',
    ]);
  });

  it('leaves out a change it cannot name', () => {
    const { entries } = buildQuoteThread(
      [],
      quotation([
        change(
          'create',
          null,
          'REQUEST_DRAFT',
          'CUSTOMER',
          '2026-11-16T10:00:00Z',
        ),
        change('mystery', 'PENDING', 'DRAFT', 'SELLER', '2026-11-16T10:01:00Z'),
        change(
          'mystery',
          'PENDING',
          'SOMETHING_NEW',
          'SELLER',
          '2026-11-16T10:02:00Z',
        ),
      ]),
    );

    expect(entries).toEqual([]);
  });

  it('splits a rejection by who made it and what it rejected', () => {
    const { entries } = buildQuoteThread(
      [],
      quotation([
        change(
          'reject',
          'REQUESTED',
          'REJECTED',
          'CUSTOMER',
          '2026-11-16T10:00:00Z',
        ),
        change(
          'reject',
          'PENDING',
          'REJECTED',
          'CUSTOMER',
          '2026-11-16T10:01:00Z',
        ),
        change(
          'reject',
          'REQUESTED',
          'REJECTED',
          'SELLER',
          '2026-11-16T10:02:00Z',
        ),
        change(
          'reject',
          'PENDING',
          'REJECTED',
          'SELLER',
          '2026-11-16T10:03:00Z',
        ),
      ]),
    );

    expect(entries.map((e) => e.event?.type)).toEqual([
      'withdrawn',
      'declined',
      'request_rejected',
      'quote_rejected',
    ]);
  });

  describe('the version of each entry', () => {
    /** `revisions` as Geins answers them: newest first, the request last. */
    const revisions = (...numbers: [string, string | null][]) =>
      numbers.map(([quotationNumber, validFrom]) => ({
        quotationId: `id-${quotationNumber}`,
        quotationNumber,
        validFrom,
      }));

    const versionOf = (e: QuoteThreadEntry) =>
      !e.version
        ? '-'
        : e.version.kind === 'request'
          ? 'request'
          : e.version.number;

    /** What happened and on which version. */
    const tagged = (entries: QuoteThreadEntry[]) =>
      entries.map((e) =>
        [e.event?.type ?? 'message', e.text, versionOf(e)]
          .filter(Boolean)
          .join(' '),
      );

    it('tags a request and three offers, messages and events, each with its own version', () => {
      const n = (s: string) => `2611-2-1066-${s}`;
      const { entries } = buildQuoteThread(
        [
          message({
            type: 'FROM_CUSTOMER',
            authorName: 'Anna Berg',
            message: 'Förfrågan',
            timestamp: '2026-11-18T08:00:01Z',
            quotationNumber: n('00'),
          }),
          message({
            type: 'FROM_CUSTOMER',
            authorName: 'Anna Berg',
            message: 'Och en fråga',
            timestamp: '2026-11-18T08:05:00Z',
            quotationNumber: n('00'),
            tags: [{ key: 'source', value: 'chat' }],
          }),
          message({
            message: 'Här är offerten',
            timestamp: '2026-11-18T09:01:00Z',
            quotationNumber: n('01'),
          }),
          message({
            type: 'FROM_CUSTOMER',
            authorName: 'Anna Berg',
            message: 'Kan ni sänka priset?',
            timestamp: '2026-11-18T10:01:00Z',
            quotationNumber: n('02'),
          }),
          message({
            message: 'Sänkt',
            timestamp: '2026-11-18T11:01:00Z',
            quotationNumber: n('03'),
          }),
        ],
        quotation(
          [
            change(
              'create',
              null,
              'REQUEST_DRAFT',
              'CUSTOMER',
              '2026-11-18T07:59:00Z',
              n('00'),
            ),
            change(
              'release',
              'REQUEST_DRAFT',
              'REQUESTED',
              'CUSTOMER',
              '2026-11-18T08:00:02Z',
              n('00'),
            ),
            change(
              'revise',
              'REQUESTED',
              'REVISED',
              'SELLER',
              '2026-11-18T09:00:00.1Z',
              n('00'),
            ),
            change(
              'send',
              'DRAFT',
              'PENDING',
              'SELLER',
              '2026-11-18T09:00:00.2Z',
              n('01'),
            ),
            change(
              'revise',
              'PENDING',
              'REVISED',
              'SELLER',
              '2026-11-18T10:00:00.1Z',
              n('01'),
            ),
            change(
              'send',
              'DRAFT',
              'PENDING',
              'SELLER',
              '2026-11-18T10:00:00.2Z',
              n('02'),
            ),
            change(
              'revise',
              'PENDING',
              'REVISED',
              'SELLER',
              '2026-11-18T11:00:00.1Z',
              n('02'),
            ),
            change(
              'send',
              'DRAFT',
              'PENDING',
              'SELLER',
              '2026-11-18T11:00:00.2Z',
              n('03'),
            ),
          ],
          {
            revisions: revisions(
              [n('03'), '2026-11-18T11:00:00.2Z'],
              [n('02'), '2026-11-18T10:00:00.2Z'],
              [n('01'), '2026-11-18T09:00:00.2Z'],
              [n('00'), null],
            ),
          },
        ),
      );

      expect(tagged(entries)).toEqual([
        'request_sent Förfrågan request',
        'message Och en fråga request',
        `quote_sent ${n('01')}`,
        `message Här är offerten ${n('01')}`,
        `revision_sent ${n('02')}`,
        `message Kan ni sänka priset? ${n('02')}`,
        `revision_sent ${n('03')}`,
        `message Sänkt ${n('03')}`,
      ]);
    });

    it('tags a quotation the seller started from its first offer on', () => {
      const n = (s: string) => `2611-2-1067-${s}`;
      const { entries } = buildQuoteThread(
        [],
        quotation(
          [
            change(
              'send',
              'DRAFT',
              'PENDING',
              'SELLER',
              '2026-11-18T09:00:00Z',
              n('00'),
            ),
            change(
              'revise',
              'PENDING',
              'REVISED',
              'SELLER',
              '2026-11-18T10:00:00.1Z',
              n('00'),
            ),
            change(
              'send',
              'DRAFT',
              'PENDING',
              'SELLER',
              '2026-11-18T10:00:00.2Z',
              n('01'),
            ),
            change(
              'revise',
              'PENDING',
              'REVISED',
              'SELLER',
              '2026-11-18T11:00:00.1Z',
              n('01'),
            ),
            change(
              'send',
              'DRAFT',
              'PENDING',
              'SELLER',
              '2026-11-18T11:00:00.2Z',
              n('02'),
            ),
          ],
          {
            revisions: revisions(
              [n('02'), '2026-11-18T11:00:00.2Z'],
              [n('01'), '2026-11-18T10:00:00.2Z'],
              [n('00'), '2026-11-18T09:00:00Z'],
            ),
          },
        ),
      );

      expect(tagged(entries)).toEqual([
        `quote_sent ${n('00')}`,
        `revision_sent ${n('01')}`,
        `revision_sent ${n('02')}`,
      ]);
    });

    it("tags a change on the live version with that version's name", () => {
      const n = (s: string) => `2611-2-1068-${s}`;
      const { entries } = buildQuoteThread(
        [],
        quotation(
          [
            change(
              'send',
              'DRAFT',
              'PENDING',
              'SELLER',
              '2026-11-18T09:00:00Z',
              n('00'),
            ),
            change(
              'revise',
              'PENDING',
              'REVISED',
              'SELLER',
              '2026-11-18T10:00:00.1Z',
              n('00'),
            ),
            change(
              'send',
              'DRAFT',
              'PENDING',
              'SELLER',
              '2026-11-18T10:00:00.2Z',
              n('01'),
            ),
            change(
              'cancel',
              'PENDING',
              'CANCELED',
              'SELLER',
              '2026-11-18T11:00:00Z',
              n('01'),
            ),
          ],
          {
            revisions: revisions(
              [n('01'), '2026-11-18T10:00:00.2Z'],
              [n('00'), '2026-11-18T09:00:00Z'],
            ),
          },
        ),
      );

      expect(tagged(entries)).toEqual([
        `quote_sent ${n('00')}`,
        `revision_sent ${n('01')}`,
        `canceled ${n('01')}`,
      ]);
    });

    it('tags a message sent with a new version by the version it was written on', () => {
      const at = '2026-11-18T10:00:00.2Z';
      const { entries } = buildQuoteThread(
        [
          message({
            message: 'Ny version med rabatt',
            timestamp: at,
            quotationNumber: '2611-2-0001-01',
            tags: statusTags('send', 'draft', 'pending'),
          }),
        ],
        quotation(
          [
            change(
              'revise',
              'PENDING',
              'REVISED',
              'SELLER',
              '2026-11-18T10:00:00.1Z',
              '2611-2-0001-00',
            ),
            change('send', 'DRAFT', 'PENDING', 'SELLER', at, '2611-2-0001-01'),
          ],
          {
            revisions: revisions(
              ['2611-2-0001-01', at],
              ['2611-2-0001-00', '2026-11-18T09:00:00Z'],
            ),
          },
        ),
      );

      expect(tagged(entries)).toEqual([
        'revision_sent Ny version med rabatt 2611-2-0001-01',
      ]);
    });

    it('leaves untagged what was written on a version the buyer cannot see', () => {
      const { entries } = buildQuoteThread(
        [
          message({ message: 'Utan nummer' }),
          message({
            message: 'På ett utkast',
            quotationNumber: '2611-2-1069-02',
          }),
        ],
        quotation([], {
          revisions: revisions(
            ['2611-2-1069-01', '2026-11-18T10:00:00Z'],
            ['2611-2-1069-00', '2026-11-18T09:00:00Z'],
          ),
        }),
      );

      expect(tagged(entries)).toEqual([
        'message Utan nummer -',
        'message På ett utkast -',
      ]);
    });

    it('tags only the request when the store shows a number the versions lack', () => {
      const n = (s: string) => `2611-2-1066-${s}`;
      const { entries } = buildQuoteThread(
        [
          message({
            type: 'FROM_CUSTOMER',
            message: 'Förfrågan',
            timestamp: '2026-11-18T08:00:01Z',
            quotationNumber: n('00'),
          }),
          message({
            message: 'Här är offerten',
            timestamp: '2026-11-18T09:01:00Z',
            quotationNumber: n('01'),
          }),
        ],
        quotation([], {
          revisions: revisions(
            [n('01'), '2026-11-18T09:00:00Z'],
            [n('00'), null],
          ),
        }),
        'externalNumber',
      );

      expect(tagged(entries)).toEqual([
        'request_sent Förfrågan request',
        'message Här är offerten -',
      ]);
    });

    it('tags by the quotation number when the store shows that', () => {
      const { entries } = buildQuoteThread(
        [message({ message: 'Hej', quotationNumber: '2611-2-0001-01' })],
        quotation([], {
          revisions: revisions(
            ['2611-2-0001-01', '2026-11-18T09:00:00Z'],
            ['2611-2-0001-00', null],
          ),
        }),
        'quotationNumber',
      );

      expect(tagged(entries)).toEqual(['message Hej 2611-2-0001-01']);
    });

    it.each<[string, [string, string | null][] | undefined]>([
      ['one version', [['2611-2-0001-00', '2026-11-18T09:00:00Z']]],
      ['no versions', []],
      ['no revisions at all', undefined],
    ])('tags nothing with %s', (_, list) => {
      const { entries } = buildQuoteThread(
        [message({ message: 'Hej', quotationNumber: '2611-2-0001-00' })],
        quotation(
          [
            change(
              'accept',
              'PENDING',
              'ACCEPTED',
              'CUSTOMER',
              '2026-11-18T10:00:00Z',
              '2611-2-0001-00',
            ),
          ],
          list ? { revisions: revisions(...list) } : {},
        ),
      );

      expect(entries).toHaveLength(2);
      for (const entry of entries) expect(entry).not.toHaveProperty('version');
    });

    it('tags nothing without the history', () => {
      const { entries } = buildQuoteThread([
        message({ message: 'Hej', quotationNumber: '2611-2-0001-01' }),
      ]);

      expect(entries[0]).not.toHaveProperty('version');
    });
  });

  describe('the request comment', () => {
    const comment = (overrides: Partial<Message> = {}) =>
      message({
        type: 'FROM_CUSTOMER',
        authorName: 'Lisa Ek',
        message: 'Leverans i december',
        timestamp: '2026-11-16T08:55:21.66Z',
        ...overrides,
      });
    const release = change(
      'release',
      'REQUEST_DRAFT',
      'REQUESTED',
      'CUSTOMER',
      '2026-11-16T08:55:22.17Z',
    );

    it('stands for the release, so "sent the request" shows once', () => {
      const first = comment();
      const { entries } = buildQuoteThread([first], quotation([release]));

      expect(log(entries)).toEqual([
        '2026-11-16T08:55:21.66Z buyer Lisa Ek request_sent Leverans i december',
      ]);
      expect(entries[0]!.id).toBe(first.id);
    });

    it('stands for the release also without text', () => {
      const { entries } = buildQuoteThread(
        [comment({ message: '' })],
        quotation([release]),
      );

      expect(log(entries)).toEqual([
        '2026-11-16T08:55:21.66Z buyer Lisa Ek request_sent',
      ]);
    });

    it('leaves the release as the event when there is no comment', () => {
      const { entries } = buildQuoteThread([], quotation([release]));

      expect(log(entries)).toEqual([
        '2026-11-16T08:55:22.17Z buyer Anna Berg request_sent',
      ]);
    });
  });

  it('reads a history that starts partway, with the messages from before it', () => {
    const { entries } = buildQuoteThread(
      [
        message({
          type: 'FROM_CUSTOMER',
          authorName: 'Lisa Ek',
          message: '',
          timestamp: '2026-11-12T16:16:10Z',
          tags: [{ key: 'customerOrderNumber', value: 'PO-1' }],
        }),
        message({
          type: 'FROM_CUSTOMER',
          authorName: 'Lisa Ek',
          message: 'Tack',
          timestamp: '2026-11-16T12:26:23.79Z',
          tags: statusTags('accept', 'pending', 'accepted'),
        }),
      ],
      quotation([
        change(
          'revise',
          'REQUESTED',
          'REVISED',
          'SELLER',
          '2026-11-16T12:12:46.19Z',
          '2611-2-0466-00',
        ),
        change(
          'send',
          'DRAFT',
          'PENDING',
          'SELLER',
          '2026-11-16T12:12:46.25Z',
          '2611-2-0466-01',
        ),
        change(
          'accept',
          'PENDING',
          'ACCEPTED',
          'CUSTOMER',
          '2026-11-16T12:26:23.79Z',
          '2611-2-0466-01',
        ),
      ]),
    );

    expect(log(entries)).toEqual([
      '2026-11-12T16:16:10Z buyer Lisa Ek request_sent',
      '2026-11-16T12:12:46.25Z seller - quote_sent',
      '2026-11-16T12:26:23.79Z buyer Lisa Ek accepted Tack',
    ]);
  });

  it('reads no history as before: the messages only', () => {
    const messages = [
      message({
        type: 'FROM_CUSTOMER',
        authorName: 'Lisa Ek',
        timestamp: '2026-11-01T08:00:00Z',
      }),
      message({ tags: statusTags('send', 'requested', 'pending') }),
    ];
    const before = buildQuoteThread(messages);

    expect(buildQuoteThread(messages, quotation([]))).toEqual(before);
    expect(
      buildQuoteThread(messages, quotation([], { statusHistory: null })),
    ).toEqual(before);
    expect(buildQuoteThread(messages, null)).toEqual(before);
  });

  describe('who made a change', () => {
    it('names no one when the quotation simply expired', () => {
      const { entries } = buildQuoteThread(
        [],
        quotation([
          change(
            'expire',
            'PENDING',
            'EXPIRED',
            'SYSTEM',
            '2026-11-16T10:00:00Z',
          ),
        ]),
      );

      expect(entries).toEqual([
        {
          id: expect.stringMatching(/^history-/),
          at: '2026-11-16T10:00:00Z',
          side: 'system',
          event: { type: 'expired', from: 'pending', to: 'expired' },
        },
      ]);
    });

    it('names the side when the seller marked it expired', () => {
      const { entries } = buildQuoteThread(
        [],
        quotation([
          change(
            'expire',
            'PENDING',
            'EXPIRED',
            'SELLER',
            '2026-11-16T10:00:00Z',
          ),
        ]),
      );

      expect(log(entries)).toEqual(['2026-11-16T10:00:00Z seller - expired']);
    });

    it("counts any other change Geins or Monitor made as the seller's", () => {
      const { entries } = buildQuoteThread(
        [],
        quotation([
          change(
            'confirm',
            'ACCEPTED',
            'CONFIRMED',
            'EXTERNAL',
            '2026-11-16T10:00:00Z',
          ),
          change(
            'cancel',
            'PENDING',
            'CANCELED',
            'SYSTEM',
            '2026-11-16T10:01:00Z',
          ),
        ]),
      );

      expect(log(entries)).toEqual([
        '2026-11-16T10:00:00Z seller - confirmed',
        '2026-11-16T10:01:00Z seller - canceled',
      ]);
    });

    it("leaves the buyer's name out when the quotation has none", () => {
      const { entries } = buildQuoteThread(
        [],
        quotation(
          [
            change(
              'accept',
              'PENDING',
              'ACCEPTED',
              'CUSTOMER',
              '2026-11-16T10:00:00Z',
            ),
            change(
              'confirm',
              'ACCEPTED',
              'CONFIRMED',
              'SELLER',
              '2026-11-16T10:01:00Z',
            ),
          ],
          { customer: null },
        ),
      );

      expect(log(entries)).toEqual([
        '2026-11-16T10:00:00Z buyer - accepted',
        '2026-11-16T10:01:00Z seller - confirmed',
      ]);
    });

    it('names a person by the part of the name there is', () => {
      const { entries } = buildQuoteThread(
        [],
        quotation(
          [
            change(
              'accept',
              'PENDING',
              'ACCEPTED',
              'CUSTOMER',
              '2026-11-16T10:00:00Z',
            ),
          ],
          { customer: { firstName: null, lastName: 'Berg' } },
        ),
      );

      expect(entries[0]!.authorName).toBe('Berg');
    });

    it('reads a blank part of the name as none', () => {
      const named = (customer: { firstName: string; lastName: string }) =>
        buildQuoteThread(
          [],
          quotation(
            [
              change(
                'accept',
                'PENDING',
                'ACCEPTED',
                'CUSTOMER',
                '2026-11-16T10:00:00Z',
              ),
            ],
            { customer },
          ),
        ).entries[0]!.authorName;

      expect(named({ firstName: ' ', lastName: 'Berg ' })).toBe('Berg');
      expect(named({ firstName: ' ', lastName: '' })).toBeUndefined();
    });
  });

  it('puts the order number on the placed order, written with a message or not', () => {
    const at = '2026-11-16T11:00:00Z';
    const { entries } = buildQuoteThread(
      [
        message({
          type: 'FROM_CUSTOMER',
          message: 'Beställt',
          timestamp: at,
          tags: statusTags('finalize', 'confirmed', 'finalized'),
        }),
      ],
      quotation(
        [
          change('finalize', 'CONFIRMED', 'FINALIZED', 'CUSTOMER', at),
          change(
            'finalize',
            'ACCEPTED',
            'FINALIZED',
            'CUSTOMER',
            '2026-11-16T12:00:00Z',
          ),
        ],
        { orderId: '100512' },
      ),
    );

    expect(entries.map((e) => e.event)).toEqual([
      {
        type: 'ordered',
        from: 'confirmed',
        to: 'finalized',
        orderNumber: '100512',
      },
      {
        type: 'ordered',
        from: 'accepted',
        to: 'finalized',
        orderNumber: '100512',
      },
    ]);
  });

  it('puts the order number on the placed order only', () => {
    const { entries } = buildQuoteThread(
      [message({ message: 'Hej', timestamp: '2026-11-16T09:00:00Z' })],
      quotation(
        [
          change(
            'accept',
            'PENDING',
            'ACCEPTED',
            'CUSTOMER',
            '2026-11-16T10:00:00Z',
          ),
        ],
        { orderId: '100512' },
      ),
    );

    expect(entries.map((e) => e.event?.orderNumber)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('puts no order number on the placed order when the quotation has none', () => {
    const { entries } = buildQuoteThread(
      [],
      quotation([
        change(
          'finalize',
          'CONFIRMED',
          'FINALIZED',
          'CUSTOMER',
          '2026-11-16T12:00:00Z',
        ),
      ]),
    );

    expect(entries[0]!.event).not.toHaveProperty('orderNumber');
  });

  it('gives two changes of the same instant an id each', () => {
    const at = '2026-11-16T12:00:00Z';
    const { entries } = buildQuoteThread(
      [],
      quotation([
        change('accept', 'PENDING', 'ACCEPTED', 'CUSTOMER', at),
        change('confirm', 'ACCEPTED', 'CONFIRMED', 'SYSTEM', at),
      ]),
    );

    expect(new Set(entries.map((e) => e.id)).size).toBe(2);
  });

  it('places changes and messages by time together', () => {
    const { entries } = buildQuoteThread(
      [
        message({ message: 'Före', timestamp: '2026-11-16T09:00:00Z' }),
        message({ message: 'Efter', timestamp: '2026-11-16T11:00:00Z' }),
      ],
      quotation([
        change(
          'accept',
          'PENDING',
          'ACCEPTED',
          'CUSTOMER',
          '2026-11-16T10:00:00Z',
        ),
      ]),
    );

    expect(log(entries)).toEqual([
      '2026-11-16T09:00:00Z seller Erik Sälj message Före',
      '2026-11-16T10:00:00Z buyer Anna Berg accepted',
      '2026-11-16T11:00:00Z seller Erik Sälj message Efter',
    ]);
  });

  it("locks the buyer's message once a change follows it, written or not", () => {
    const own = message({
      type: 'FROM_CUSTOMER',
      editable: true,
      timestamp: '2026-11-16T09:00:00Z',
      tags: [{ key: 'source', value: 'chat' }],
    });
    const history = [
      change(
        'accept',
        'PENDING',
        'ACCEPTED',
        'CUSTOMER',
        '2026-11-16T10:00:00Z',
      ),
    ];

    expect(buildQuoteThread([own], quotation([])).entries[0]!.deletable).toBe(
      true,
    );
    expect(
      buildQuoteThread([own], quotation(history)).entries[0],
    ).not.toHaveProperty('deletable');
  });
});

describe('getQuoteThread', () => {
  const event = { context: {} } as H3Event;

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

  /** Geins answers each read by its query file. */
  function answer(answers: {
    messages?: () => Promise<unknown>;
    history?: () => Promise<unknown>;
  }) {
    mockGraphqlQuery.mockImplementation(
      ({ queryAsString }: { queryAsString: string }) =>
        queryAsString === 'query:quotes/quotation-history.graphql'
          ? (answers.history?.() ?? Promise.resolve(null))
          : (answers.messages?.() ?? Promise.resolve(null)),
    );
  }

  const HISTORY = {
    getQuotationCart: {
      id: 'q-1',
      quotation: {
        orderId: null,
        customer: { firstName: 'Anna', lastName: 'Berg' },
        statusHistory: [
          {
            timestamp: '2026-11-10T09:00:00Z',
            action: 'accept',
            statusFrom: 'PENDING',
            statusTo: 'ACCEPTED',
            actor: 'CUSTOMER',
            quotationNumber: '2611-2-0001-00',
          },
        ],
      },
    },
  };

  it("reads the quotation's status history beside the messages, and merges it", async () => {
    answer({
      messages: async () => ({
        getQuotationMessages: [message({ message: 'Hej' })],
      }),
      history: async () => HISTORY,
    });

    const thread = await getQuoteThread('q-1', event);

    expect(mockGraphqlQuery).toHaveBeenCalledWith({
      queryAsString: 'query:quotes/quotation-history.graphql',
      variables: { quotationId: 'q-1' },
      userToken: 'user-token',
    });
    expect(mockWrapServiceCall.mock.calls.map((c) => c[1])).toEqual([
      'quotes',
      'quotes',
    ]);
    expect(lines(thread.entries)).toEqual([
      '2026-11-10T08:00:00Z seller message Hej',
      '2026-11-10T09:00:00Z buyer accepted ',
    ]);
    expect(thread.entries[1]!.authorName).toBe('Anna Berg');
    expect(thread.messageCount).toBe(1);
  });

  it('tags each entry with its version from the revisions the history read answers', async () => {
    answer({
      messages: async () => ({
        getQuotationMessages: [
          message({ message: 'Hej', quotationNumber: '2611-2-0001-00' }),
        ],
      }),
      history: async () => ({
        getQuotationCart: {
          id: 'q-1',
          quotation: {
            ...HISTORY.getQuotationCart.quotation,
            revisions: [
              {
                quotationId: 'q-2',
                quotationNumber: '2611-2-0001-01',
                validFrom: '2026-11-10T08:30:00Z',
              },
              {
                quotationId: 'q-1',
                quotationNumber: '2611-2-0001-00',
                validFrom: null,
              },
            ],
          },
        },
      }),
    });

    const thread = await getQuoteThread('q-1', event);

    expect(thread.entries.map((e) => e.version)).toEqual([
      { kind: 'request' },
      { kind: 'request' },
    ]);
  });

  it("names the versions by the number the store's setting shows", async () => {
    const revisions = [
      {
        quotationId: 'q-2',
        quotationNumber: '2611-2-0001-01',
        validFrom: '2026-11-10T08:30:00Z',
      },
      {
        quotationId: 'q-1',
        quotationNumber: '2611-2-0001-00',
        validFrom: null,
      },
    ];
    answer({
      messages: async () => ({
        getQuotationMessages: [
          message({ message: 'Hej', quotationNumber: '2611-2-0001-01' }),
        ],
      }),
      history: async () => ({
        getQuotationCart: {
          id: 'q-1',
          quotation: { statusHistory: [], revisions },
        },
      }),
    });
    const onStore = (quoteDisplayNumber: string) =>
      ({
        context: { tenant: { config: { quoteDisplayNumber } } },
      }) as unknown as H3Event;

    const shown = await getQuoteThread('q-1', onStore('quotationNumber'));
    const external = await getQuoteThread('q-1', onStore('externalNumber'));
    // A tenant without its config reads as the default.
    const unset = await getQuoteThread('q-1', {
      context: { tenant: { hostname: 'shop.example' } },
    } as unknown as H3Event);

    expect(shown.entries[0]!.version).toEqual({
      kind: 'offer',
      number: '2611-2-0001-01',
    });
    expect(external.entries[0]).not.toHaveProperty('version');
    expect(unset.entries[0]!.version).toEqual(shown.entries[0]!.version);
  });

  it("names the side, not the quotation's owner, on a seller's change without a message", async () => {
    answer({
      messages: async () => ({ getQuotationMessages: [] }),
      history: async () => ({
        getQuotationCart: {
          id: 'q-1',
          quotation: {
            orderId: null,
            customer: null,
            owner: { firstName: 'Erik', lastName: 'Sälj' },
            statusHistory: [
              {
                timestamp: '2026-11-10T09:00:00Z',
                action: 'send',
                statusFrom: 'DRAFT',
                statusTo: 'PENDING',
                actor: 'SELLER',
                quotationNumber: '2611-2-0001-00',
              },
            ],
          },
        },
      }),
    });

    const { entries } = await getQuoteThread('q-1', event);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.side).toBe('seller');
    expect(entries[0]).not.toHaveProperty('authorName');
  });

  it('reads the messages alone when Geins answers no quotation', async () => {
    answer({
      messages: async () => ({
        getQuotationMessages: [message({ message: 'Hej' })],
      }),
      history: async () => ({ getQuotationCart: null }),
    });

    const thread = await getQuoteThread('q-1', event);

    expect(lines(thread.entries)).toEqual([
      '2026-11-10T08:00:00Z seller message Hej',
    ]);
    // No history is not a failed read.
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('shows the messages as before when the history cannot be read, and says so in the log', async () => {
    const messages = [
      message({ message: 'Hej', tags: statusTags('send', 'draft', 'pending') }),
    ];
    answer({
      messages: async () => ({ getQuotationMessages: messages }),
      history: async () => {
        throw new Error('statusHistory');
      },
    });

    expect(await getQuoteThread('q-1', event)).toEqual(
      buildQuoteThread(messages),
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('history'),
      expect.objectContaining({ quoteId: 'q-1' }),
    );
  });

  it('fails when the messages cannot be read, even with the history read', async () => {
    answer({
      messages: async () => {
        throw new Error('enum');
      },
      history: async () => HISTORY,
    });

    await expect(getQuoteThread('q-1', event)).rejects.toThrow('enum');
  });

  it('answers an empty thread when Geins answers nothing at all', async () => {
    mockGraphqlQuery.mockResolvedValue(null);

    expect(await getQuoteThread('q-1', event)).toEqual({
      entries: [],
      messageCount: 0,
    });
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
  const event = { context: {} } as H3Event;
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

describe('deleteQuoteMessage', () => {
  const event = { context: {} } as H3Event;

  const own = (overrides: Partial<Message> = {}) =>
    message({
      id: 'mine',
      type: 'FROM_CUSTOMER',
      editable: true,
      tags: [{ key: 'source', value: 'chat' }],
      ...overrides,
    });

  /** The messages, and a quotation with no history yet. */
  function thread(...messages: Message[]) {
    mockGraphqlQuery.mockImplementation(
      ({ queryAsString }: { queryAsString: string }) =>
        Promise.resolve(
          queryAsString === 'query:quotes/quotation-history.graphql'
            ? {
                getQuotationCart: {
                  id: 'q-1',
                  quotation: { statusHistory: [] },
                },
              }
            : { getQuotationMessages: messages },
        ),
    );
  }

  beforeEach(() => {
    mockGraphqlMutation.mockResolvedValue({ deleteQuotationMessage: true });
  });

  it('reads the thread again, then deletes the message as the buyer', async () => {
    thread(own());

    await deleteQuoteMessage('q-1', 'mine', event);

    expect(mockGraphqlQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { quotationId: 'q-1' },
        userToken: 'user-token',
      }),
    );
    expect(mockGraphqlMutation).toHaveBeenCalledWith({
      queryAsString: 'query:quotes/delete-quotation-message.graphql',
      variables: { quotationId: 'q-1', messageId: 'mine', ...CHANNEL },
      userToken: 'user-token',
      requestOptions: { context: { timeoutMs: 0 } },
    });
    // The messages and the history, then the delete.
    expect(mockWrapServiceCall.mock.calls.map((c) => c[1])).toEqual([
      'quotes',
      'quotes',
      'quotes',
    ]);
  });

  it('refuses a message the seller has written after, without asking Geins', async () => {
    thread(
      own({ timestamp: '2026-11-10T08:00:00Z' }),
      message({ timestamp: '2026-11-10T09:00:00Z' }),
    );

    await expect(
      deleteQuoteMessage('q-1', 'mine', event),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Message mine on quote q-1 can no longer be deleted',
    });
    expect(mockGraphqlMutation).not.toHaveBeenCalled();
  });

  it('answers not found for a message the buyer cannot see, without asking Geins', async () => {
    thread(own());

    await expect(
      deleteQuoteMessage('q-1', 'someone-else', event),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'No message someone-else on quote q-1',
    });
    expect(mockGraphqlMutation).not.toHaveBeenCalled();
  });

  it('deletes without a user token when the request carries no context', async () => {
    const { buildRequestContext } =
      await import('../../../server/services/_sdk');
    // The thread read asks for the context first, then the delete.
    vi.mocked(buildRequestContext)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);
    thread(own());

    await deleteQuoteMessage('q-1', 'mine', event);

    expect(mockGraphqlMutation).toHaveBeenCalledWith(
      expect.objectContaining({ userToken: undefined }),
    );
  });

  it('refuses the delete when the history cannot be read, without asking Geins to delete', async () => {
    mockGraphqlQuery.mockImplementation(
      ({ queryAsString }: { queryAsString: string }) =>
        queryAsString === 'query:quotes/quotation-history.graphql'
          ? Promise.reject(new Error('statusHistory'))
          : Promise.resolve({ getQuotationMessages: [own()] }),
    );

    await expect(deleteQuoteMessage('q-1', 'mine', event)).rejects.toThrow(
      'statusHistory',
    );
    // Through the service wrapper, so the route answers a failed read (502).
    expect(mockWrapServiceCall.mock.calls.map((c) => c[1])).toEqual([
      'quotes',
      'quotes',
    ]);
    expect(mockGraphqlMutation).not.toHaveBeenCalled();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it.each([
    ['no quotation', { getQuotationCart: null }],
    ['nothing at all', null],
  ])(
    'refuses the delete when Geins answers %s for the history',
    async (_what, history) => {
      mockGraphqlQuery.mockImplementation(
        ({ queryAsString }: { queryAsString: string }) =>
          Promise.resolve(
            queryAsString === 'query:quotes/quotation-history.graphql'
              ? history
              : { getQuotationMessages: [own()] },
          ),
      );

      await expect(
        deleteQuoteMessage('q-1', 'mine', event),
      ).rejects.toMatchObject({
        code: 'EXTERNAL_API_ERROR',
        message: 'Geins answered no status history for quote q-1',
      });
      expect(mockGraphqlMutation).not.toHaveBeenCalled();
    },
  );

  it('fails when Geins answers that nothing was deleted', async () => {
    thread(own());
    mockGraphqlMutation.mockResolvedValue({ deleteQuotationMessage: false });

    await expect(
      deleteQuoteMessage('q-1', 'mine', event),
    ).rejects.toMatchObject({
      code: 'EXTERNAL_API_ERROR',
      message: 'Geins deleted no message mine on quote q-1',
    });
  });

  it('fails when Geins refuses the delete', async () => {
    thread(own());
    mockGraphqlMutation.mockRejectedValue(new Error('not editable'));

    await expect(deleteQuoteMessage('q-1', 'mine', event)).rejects.toThrow(
      'not editable',
    );
  });
});

describe('a log call Geins fails', () => {
  const event = { context: {} } as H3Event;
  const refused = new Error('Quotation not found');
  const notFound = () =>
    createError({ statusCode: 404, message: 'Quote q-1 not found' });
  /** The buyer's own message, and a quotation with no history yet. */
  const ownThread = () =>
    mockGraphqlQuery.mockImplementation(
      ({ queryAsString }: { queryAsString: string }) =>
        Promise.resolve(
          queryAsString === 'query:quotes/quotation-history.graphql'
            ? {
                getQuotationCart: {
                  id: 'q-1',
                  quotation: { statusHistory: [] },
                },
              }
            : {
                getQuotationMessages: [
                  message({
                    id: 'mine',
                    type: 'FROM_CUSTOMER',
                    editable: true,
                    tags: [{ key: 'source', value: 'chat' }],
                  }),
                ],
              },
        ),
    );

  describe.each([
    {
      call: 'the thread read',
      fail: () => mockGraphqlQuery.mockRejectedValue(refused),
      answer: () =>
        mockGraphqlQuery.mockResolvedValue({ getQuotationMessages: [] }),
      run: () => getQuoteThread('q-1', event),
    },
    {
      call: 'the message write',
      fail: () => mockGraphqlMutation.mockRejectedValue(refused),
      answer: () =>
        mockGraphqlMutation.mockResolvedValue({
          createQuotationMessage: { id: 'm-new' },
        }),
      run: () => createQuoteMessage('q-1', { message: 'Hej' }, event),
    },
    {
      call: "the delete's thread read",
      fail: () => mockGraphqlQuery.mockRejectedValue(refused),
      answer: () => {
        ownThread();
        mockGraphqlMutation.mockResolvedValue({ deleteQuotationMessage: true });
      },
      run: () => deleteQuoteMessage('q-1', 'mine', event),
    },
    {
      call: 'the delete',
      fail: () => {
        ownThread();
        mockGraphqlMutation.mockRejectedValue(refused);
      },
      answer: () => {
        ownThread();
        mockGraphqlMutation.mockResolvedValue({ deleteQuotationMessage: true });
      },
      run: () => deleteQuoteMessage('q-1', 'mine', event),
    },
  ])('$call', ({ fail, answer, run }) => {
    it('answers 404 when the buyer cannot read the quotation either', async () => {
      fail();
      const missing = notFound();
      mockGetQuote.mockRejectedValue(missing);

      await expect(run()).rejects.toBe(missing);
      expect(mockGetQuote).toHaveBeenCalledWith('q-1', event);
    });

    it('keeps its own failure when the buyer can read the quotation', async () => {
      fail();

      await expect(run()).rejects.toBe(refused);
      expect(mockGetQuote).toHaveBeenCalledOnce();
    });

    it('keeps its own failure when the quotation read fails otherwise', async () => {
      fail();
      mockGetQuote.mockRejectedValue(
        createError({ statusCode: 502, message: 'Bad Gateway' }),
      );

      await expect(run()).rejects.toBe(refused);
    });

    it('reads no quotation when Geins answers', async () => {
      answer();

      await run();

      expect(mockGetQuote).not.toHaveBeenCalled();
    });
  });

  it.each([
    [
      'no message',
      () => {
        mockGraphqlMutation.mockResolvedValue({ createQuotationMessage: null });
        return createQuoteMessage('q-1', { message: 'Hej' }, event);
      },
    ],
    [
      'nothing deleted',
      () => {
        ownThread();
        mockGraphqlMutation.mockResolvedValue({
          deleteQuotationMessage: false,
        });
        return deleteQuoteMessage('q-1', 'mine', event);
      },
    ],
  ])('reads no quotation when Geins answers %s', async (_label, run) => {
    await expect(run()).rejects.toMatchObject({ code: 'EXTERNAL_API_ERROR' });
    expect(mockGetQuote).not.toHaveBeenCalled();
  });
});
