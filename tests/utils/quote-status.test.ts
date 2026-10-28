import { describe, it, expect } from 'vitest';
import {
  getQuoteStatusLabelKey,
  getQuoteStatusVariant,
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
