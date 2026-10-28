/**
 * Every quotation status has a label in every locale, and the sv/en labels
 * match the prototype's quotations.status.* wording.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  QUOTE_STATUS_DISPLAY,
  getQuoteStatusLabelKey,
} from '../../app/utils/quote-status';
import type { QuoteStatus } from '../../shared/types/quote';

const LOCALES_DIR = resolve(__dirname, '../../app/locales');

function loadLocale(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf-8'));
}

function lookup(obj: Record<string, unknown>, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (cur, part) =>
        typeof cur === 'object' && cur !== null
          ? (cur as Record<string, unknown>)[part]
          : undefined,
      obj,
    );
}

const statuses = Object.keys(QUOTE_STATUS_DISPLAY) as QuoteStatus[];
const localeFiles = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));

describe('quotation status labels', () => {
  it('covers the ten portal statuses', () => {
    expect(statuses).toHaveLength(10);
  });

  describe.each(localeFiles)('%s', (file) => {
    const locale = loadLocale(file);

    it.each(statuses)('has a label for %s', (status) => {
      const label = lookup(locale, getQuoteStatusLabelKey(status));
      expect(typeof label).toBe('string');
      expect((label as string).trim()).not.toBe('');
    });
  });

  it.each<[QuoteStatus, string, string]>([
    ['request_draft', 'Utkast', 'Draft'],
    ['requested', 'Skickad', 'Submitted'],
    ['pending', 'Väntande', 'Pending'],
    ['accepted', 'Accepterad', 'Accepted'],
    ['confirmed', 'Bekräftad', 'Confirmed'],
    ['finalized', 'Slutförd', 'Finalized'],
    ['rejected', 'Avböjd', 'Declined'],
    ['canceled', 'Avbruten', 'Canceled'],
    ['expired', 'Utgången', 'Expired'],
  ])('labels %s as the prototype does (sv %s, en %s)', (status, sv, en) => {
    const key = getQuoteStatusLabelKey(status);
    expect(lookup(loadLocale('sv.json'), key)).toBe(sv);
    expect(lookup(loadLocale('en.json'), key)).toBe(en);
  });
});
