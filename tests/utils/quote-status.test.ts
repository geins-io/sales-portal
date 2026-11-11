import { describe, it, expect } from 'vitest';
import {
  QUOTE_LIST_FILTERS,
  getQuoteStatusLabelKey,
  getQuoteStatusVariant,
  isQuotePriceEstimate,
  quoteFilterOf,
} from '../../app/utils/quote-status';
import type { QuoteStatus } from '../../shared/types/quote';

describe('getQuoteStatusVariant', () => {
  it.each<[QuoteStatus, string]>([
    ['request_draft', 'draft'],
    ['requested', 'neutral'],
    ['pending', 'info'],
    ['accepted', 'success'],
    ['confirmed', 'success'],
    ['finalized', 'success-solid'],
    ['rejected', 'destructive-soft'],
    ['canceled', 'destructive-soft'],
    ['expired', 'warning'],
    ['unknown', 'neutral'],
  ])('gives %s the %s tone', (status, variant) => {
    expect(getQuoteStatusVariant(status)).toBe(variant);
  });
});

describe('getQuoteStatusLabelKey', () => {
  it.each<[QuoteStatus, string]>([
    ['request_draft', 'portal.quotations.status_request_draft'],
    ['requested', 'portal.quotations.status_requested'],
    ['pending', 'portal.quotations.status_pending'],
    ['accepted', 'portal.quotations.status_accepted'],
    ['confirmed', 'portal.quotations.status_confirmed'],
    ['finalized', 'portal.quotations.status_finalized'],
    ['rejected', 'portal.quotations.status_rejected'],
    ['canceled', 'portal.quotations.status_canceled'],
    ['expired', 'portal.quotations.status_expired'],
    ['unknown', 'portal.quotations.status_unknown'],
  ])('labels %s with %s', (status, key) => {
    expect(getQuoteStatusLabelKey(status)).toBe(key);
  });
});

describe('quoteFilterOf', () => {
  it.each<[QuoteStatus, string]>([
    ['request_draft', 'drafts'],
    ['requested', 'requests'],
    ['pending', 'quotations'],
    ['accepted', 'quotations'],
    ['confirmed', 'quotations'],
    ['finalized', 'quotations'],
    ['rejected', 'quotations'],
    ['canceled', 'quotations'],
    ['expired', 'quotations'],
    ['unknown', 'quotations'],
  ])('puts %s under the %s tab', (status, filter) => {
    expect(quoteFilterOf(status)).toBe(filter);
  });
});

describe('QUOTE_LIST_FILTERS', () => {
  it('lists the tabs in the prototype order', () => {
    expect(QUOTE_LIST_FILTERS).toEqual([
      'all',
      'drafts',
      'requests',
      'quotations',
    ]);
  });
});

describe('isQuotePriceEstimate', () => {
  it.each<[QuoteStatus, boolean]>([
    ['request_draft', true],
    ['requested', true],
    ['pending', false],
    ['accepted', false],
    ['confirmed', false],
    ['finalized', false],
    ['rejected', false],
    ['canceled', false],
    ['expired', false],
    ['unknown', false],
  ])('%s is estimated: %s', (status, estimate) => {
    expect(isQuotePriceEstimate(status)).toBe(estimate);
  });
});
