import { describe, it, expect } from 'vitest';
import { getQuoteStatusVariant } from '../../app/utils/quote-status';
import type { QuoteStatus } from '../../shared/types/quote';

describe('getQuoteStatusVariant', () => {
  it.each<[QuoteStatus, string]>([
    ['pending', 'info'],
    ['accepted', 'success'],
    ['rejected', 'destructive-soft'],
    ['cancelled', 'destructive-soft'],
    ['expired', 'warning'],
  ])('gives %s the %s tone', (status, variant) => {
    expect(getQuoteStatusVariant(status)).toBe(variant);
  });
});
