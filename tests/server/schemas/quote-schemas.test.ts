import { describe, it, expect } from 'vitest';
import {
  AcceptQuoteSchema,
  ListQuotesSchema,
  QuoteAnswerSchema,
  QuoteNamesSchema,
} from '../../../server/schemas/api-input';
import { QUOTE_MESSAGE_MAX_LENGTH } from '../../../shared/constants/quote';

// ---------------------------------------------------------------------------
// AcceptQuoteSchema
// ---------------------------------------------------------------------------
describe('AcceptQuoteSchema', () => {
  it('accepts valid quoteId', () => {
    const result = AcceptQuoteSchema.safeParse({ quoteId: 'quote-abc-123' });
    expect(result.success).toBe(true);
  });

  it('rejects empty quoteId', () => {
    const result = AcceptQuoteSchema.safeParse({ quoteId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing quoteId', () => {
    const result = AcceptQuoteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ListQuotesSchema: one page of the quotation list
// ---------------------------------------------------------------------------
describe('ListQuotesSchema', () => {
  it('reads nothing as the first 20 of every tab', () => {
    expect(ListQuotesSchema.parse({})).toEqual({
      tab: 'all',
      skip: 0,
      take: 20,
    });
  });

  it('reads the query as h3 hands it over, strings', () => {
    expect(
      ListQuotesSchema.parse({ tab: 'drafts', skip: '20', take: '20' }),
    ).toEqual({ tab: 'drafts', skip: 20, take: 20 });
  });

  it.each(['all', 'drafts', 'requests', 'quotations'])(
    'takes the tab %s',
    (tab) => {
      expect(ListQuotesSchema.parse({ tab }).tab).toBe(tab);
    },
  );

  it.each(['pending', 'ALL', ''])('refuses the tab %j', (tab) => {
    expect(ListQuotesSchema.safeParse({ tab }).success).toBe(false);
  });

  it.each([
    ['a negative skip', { skip: -1 }],
    ['a fractional skip', { skip: '1.5' }],
    ['take 0', { take: 0 }],
    ['take 101, above what Geins answers', { take: 101 }],
    ['a fractional take', { take: '2.5' }],
  ])('refuses %s', (_label, query) => {
    expect(ListQuotesSchema.safeParse(query).success).toBe(false);
  });

  it('takes 1 and 100, the ends Geins answers', () => {
    expect(ListQuotesSchema.parse({ take: '1' }).take).toBe(1);
    expect(ListQuotesSchema.parse({ take: '100' }).take).toBe(100);
  });

  it('trims the search and reads a blank one as none', () => {
    expect(ListQuotesSchema.parse({ search: '  offert  ' }).search).toBe(
      'offert',
    );
    expect(ListQuotesSchema.parse({ search: '   ' })).not.toHaveProperty(
      'search',
    );
  });

  it('takes a search of 200 characters and refuses 201, as Geins does', () => {
    expect(
      ListQuotesSchema.safeParse({ search: 'a'.repeat(200) }).success,
    ).toBe(true);
    expect(
      ListQuotesSchema.safeParse({ search: 'a'.repeat(201) }).success,
    ).toBe(false);
  });

  it('measures the search after trimming', () => {
    expect(
      ListQuotesSchema.safeParse({ search: ` ${'a'.repeat(200)} ` }).success,
    ).toBe(true);
  });

  it('takes a created range written with an offset', () => {
    const range = {
      createdFrom: '2026-11-12T00:00:00+01:00',
      createdBefore: '2026-11-13T00:00:00+01:00',
    };
    expect(ListQuotesSchema.parse(range)).toMatchObject(range);
  });

  it('takes either end of the range alone', () => {
    expect(
      ListQuotesSchema.safeParse({ createdFrom: '2026-11-12T00:00:00Z' })
        .success,
    ).toBe(true);
    expect(
      ListQuotesSchema.safeParse({ createdBefore: '2026-11-12T00:00:00Z' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['a day', '2026-11-12'],
    [
      'a time without an offset, which Geins reads as UTC',
      '2026-11-12T00:00:00',
    ],
    ['text', 'yesterday'],
  ])('refuses %s as a range end', (_label, value) => {
    expect(ListQuotesSchema.safeParse({ createdFrom: value }).success).toBe(
      false,
    );
    expect(ListQuotesSchema.safeParse({ createdBefore: value }).success).toBe(
      false,
    );
  });

  it('refuses a range that ends where or before it starts, and says why', () => {
    for (const createdBefore of [
      '2026-11-12T00:00:00+01:00',
      '2026-11-11T00:00:00+01:00',
    ]) {
      const result = ListQuotesSchema.safeParse({
        createdFrom: '2026-11-12T00:00:00+01:00',
        createdBefore,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'createdBefore must be after createdFrom',
      );
    }
  });

  it('compares the ends as instants, not as text', () => {
    // 00:30 at +01:00 is 23:30 UTC the day before, so 00:00 UTC is after it.
    expect(
      ListQuotesSchema.safeParse({
        createdFrom: '2026-11-12T00:30:00+01:00',
        createdBefore: '2026-11-12T00:00:00Z',
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// QuoteNamesSchema: the names a cart's request name could collide with
// ---------------------------------------------------------------------------
describe('QuoteNamesSchema', () => {
  it('takes a trimmed search', () => {
    expect(
      QuoteNamesSchema.parse({ search: ' Varukorg 18 nov. 2026 ' }),
    ).toEqual({ search: 'Varukorg 18 nov. 2026' });
  });

  it.each([
    ['no search', {}],
    ['a blank search', { search: '  ' }],
    ['a search of 201 characters', { search: 'a'.repeat(201) }],
  ])('refuses %s: it would read every quotation', (_label, query) => {
    expect(QuoteNamesSchema.safeParse(query).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QuoteAnswerSchema: the body of an accept, a decline or a withdrawal
// ---------------------------------------------------------------------------
describe('QuoteAnswerSchema', () => {
  it('reads no body as no message', () => {
    expect(QuoteAnswerSchema.parse(undefined)).toEqual({});
  });

  it('keeps the message and drops anything else', () => {
    expect(
      QuoteAnswerSchema.parse({ message: 'Tack!', status: 'accepted' }),
    ).toEqual({ message: 'Tack!' });
  });

  it('takes a message of 4000 characters, the limit Geins sets', () => {
    expect(QUOTE_MESSAGE_MAX_LENGTH).toBe(4000);
    const message = 'x'.repeat(4000);
    expect(QuoteAnswerSchema.parse({ message })).toEqual({ message });
  });

  it.each([
    ['over 4000 characters', 'x'.repeat(4001)],
    ['not text', 42],
  ])('refuses a message %s', (_label, message) => {
    expect(QuoteAnswerSchema.safeParse({ message }).success).toBe(false);
  });
});
