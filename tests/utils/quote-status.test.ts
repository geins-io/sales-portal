import { describe, it, expect } from 'vitest';
import { getQuoteStatusPillClass } from '../../app/utils/quote-status';
import type { QuoteStatus } from '../../shared/types/quote';

describe('getQuoteStatusPillClass', () => {
  it.each<[QuoteStatus, string]>([
    ['pending', 'muted'],
    ['accepted', 'primary'],
    ['rejected', 'destructive'],
    ['cancelled', 'destructive'],
    ['expired', 'orange'],
  ])('returns theme-aware class for %s containing %s', (status, token) => {
    expect(getQuoteStatusPillClass(status)).toContain(token);
  });

  it('returns a class string containing both bg and text utilities', () => {
    const statuses: QuoteStatus[] = [
      'pending',
      'accepted',
      'rejected',
      'expired',
      'cancelled',
    ];
    for (const status of statuses) {
      const cls = getQuoteStatusPillClass(status);
      expect(cls).toMatch(/bg-/);
      expect(cls).toMatch(/text-/);
    }
  });

  it('rejected and cancelled share the destructive palette', () => {
    expect(getQuoteStatusPillClass('rejected')).toBe(
      getQuoteStatusPillClass('cancelled'),
    );
  });
});
