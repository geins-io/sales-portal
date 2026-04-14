import { describe, it, expect } from 'vitest';
import { getQuoteStatusPillClass } from '../../app/utils/quote-status';
import type { QuoteStatus } from '../../shared/types/quote';

describe('getQuoteStatusPillClass', () => {
  it.each<[QuoteStatus, string]>([
    ['pending', 'gray'],
    ['accepted', 'green'],
    ['rejected', 'red'],
    ['expired', 'orange'],
    ['cancelled', 'rose'],
  ])('returns class for %s containing %s palette', (status, color) => {
    expect(getQuoteStatusPillClass(status)).toContain(color);
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
      expect(cls).toMatch(/bg-\w+-100/);
      expect(cls).toMatch(/text-\w+-800/);
      expect(cls).toContain('dark:');
    }
  });

  it('returns distinct class strings for all 5 statuses', () => {
    const results = new Set([
      getQuoteStatusPillClass('pending'),
      getQuoteStatusPillClass('accepted'),
      getQuoteStatusPillClass('rejected'),
      getQuoteStatusPillClass('expired'),
      getQuoteStatusPillClass('cancelled'),
    ]);
    expect(results.size).toBe(5);
  });
});
