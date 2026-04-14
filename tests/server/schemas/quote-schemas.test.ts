import { describe, it, expect } from 'vitest';
import {
  AcceptQuoteSchema,
  ListQuotesSchema,
} from '../../../server/schemas/api-input';

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
// ListQuotesSchema
// ---------------------------------------------------------------------------
describe('ListQuotesSchema', () => {
  it('accepts skip and take as numbers', () => {
    const result = ListQuotesSchema.safeParse({ skip: 0, take: 10 });
    expect(result.success).toBe(true);
  });

  it('coerces string numbers to numbers', () => {
    const result = ListQuotesSchema.safeParse({ skip: '5', take: '20' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skip).toBe(5);
      expect(result.data.take).toBe(20);
    }
  });

  it('accepts empty object (all fields optional)', () => {
    const result = ListQuotesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects negative skip', () => {
    const result = ListQuotesSchema.safeParse({ skip: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects take of 0', () => {
    const result = ListQuotesSchema.safeParse({ take: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects take exceeding 50', () => {
    const result = ListQuotesSchema.safeParse({ take: 51 });
    expect(result.success).toBe(false);
  });

  it('accepts take at maximum boundary of 50', () => {
    const result = ListQuotesSchema.safeParse({ take: 50 });
    expect(result.success).toBe(true);
  });
});
