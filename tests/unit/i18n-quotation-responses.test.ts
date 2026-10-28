/**
 * Every text the quotation view's responses and details can show exists in
 * every locale, and the sv/en wording of the accepted cases is the agreed one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  quoteKindLabelKey,
  quoteStatusInfoKey,
} from '../../app/utils/quote-view';
import { QUOTE_STATUS_DISPLAY } from '../../app/utils/quote-status';
import type { QuoteStatus } from '../../shared/types/quote';
import { makeQuote } from '../fixtures/quote';

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
const acceptCases = [
  {},
  { requiresConfirmation: true },
  { externalReference: { number: 'M-1' } },
];

const helperKeys = [
  ...statuses.map((status) => quoteKindLabelKey(status)),
  ...statuses.flatMap((status) =>
    acceptCases.map((o) => quoteStatusInfoKey(makeQuote({ status, ...o }))),
  ),
].filter((key): key is string => !!key);

const copyKeys = [
  'withdraw',
  'withdraw_title',
  'withdraw_body',
  'decline',
  'decline_title',
  'decline_body',
  'accept_plain',
  'accept_plain_title',
  'accept_plain_body',
  'accept_confirm',
  'accept_confirm_title',
  'accept_confirm_body',
  'accept_monitor',
  'accept_monitor_title',
  'accept_monitor_body',
  'note_confirm',
  'note_monitor',
  'sum_inc_vat',
  'sum_ex_vat',
  'items_count',
  'status_label',
  'accepted_at',
  'customer_and_addresses',
  'delivery_short',
].map((key) => `portal.quotations.${key}`);

const keys = [...new Set([...helperKeys, ...copyKeys])];
const localeFiles = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));

describe('quotation response texts', () => {
  describe.each(localeFiles)('%s', (file) => {
    const locale = loadLocale(file);

    it.each(keys)('has %s', (key) => {
      const text = lookup(locale, key);
      expect(typeof text).toBe('string');
      expect((text as string).trim()).not.toBe('');
    });

    it('no longer promises an order on accept', () => {
      expect(lookup(locale, 'portal.quotations.accept')).toBeUndefined();
    });
  });

  it.each([
    [
      'accepted_plain',
      'Du har accepterat offerten. Din säljare ser att den är accepterad.',
      'You have accepted the quotation. Your seller can see that it is accepted.',
    ],
    [
      'accepted_confirm',
      'Du har accepterat offerten. Den väntar på bekräftelse från din säljare.',
      'You have accepted the quotation. It is waiting for confirmation from your seller.',
    ],
    [
      'accepted_monitor',
      'Du har accepterat offerten. Ordern läggs hos din säljare och offerten visas som Slutförd när den är registrerad.',
      'You have accepted the quotation. The order is placed with your seller, and the quotation shows as Finalized once it is registered.',
    ],
    [
      'confirmed',
      'Din säljare har bekräftat offerten.',
      'Your seller has confirmed the quotation.',
    ],
  ])('words status_info_%s as agreed', (key, sv, en) => {
    const full = `portal.quotations.status_info_${key}`;
    expect(lookup(loadLocale('sv.json'), full)).toBe(sv);
    expect(lookup(loadLocale('en.json'), full)).toBe(en);
  });

  // Until ordering from a quotation exists, the confirmation case promises no order step.
  it.each([
    [
      'accept_confirm_body',
      'Du accepterar offertens priser och villkor. Din säljare bekräftar den sedan.',
      "You accept the quotation's prices and terms. Your seller then confirms it.",
    ],
    [
      'note_confirm',
      'Din säljare bekräftar efter att du har accepterat.',
      'Your seller confirms after you accept.',
    ],
  ])('words %s without an order step', (key, sv, en) => {
    const full = `portal.quotations.${key}`;
    expect(lookup(loadLocale('sv.json'), full)).toBe(sv);
    expect(lookup(loadLocale('en.json'), full)).toBe(en);
  });
});
