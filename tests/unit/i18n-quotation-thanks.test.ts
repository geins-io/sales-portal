/**
 * The two thank-you pages in the quotation flow, worded as in the prototype,
 * and the old quote-confirmation page's copy gone with it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LOCALES_DIR = resolve(__dirname, '../../app/locales');
const LOCALES = ['da', 'de', 'en', 'fi', 'nb', 'sv'];

function messages(locale: string) {
  return JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf-8'));
}

describe('quotation thank-you copy', () => {
  it('has the prototype wording in Swedish', () => {
    expect(messages('sv').portal.quotations.confirm).toEqual({
      request_title: 'Förfrågan skickad!',
      request_body: 'Tack för din offertförfrågan. Ingen order är lagd.',
      request_number: 'Förfrågan',
      next_1: 'Din säljare går igenom förfrågan.',
      next_2:
        'Du får besked när offerten är klar, och hittar den under Offerter i kundportalen.',
      next_3: 'Där kan du granska offerten och svara på den.',
      view_request: 'Visa förfrågan i kundportalen',
      request_lines: 'Artiklar i förfrågan',
      order_title: 'Beställning bekräftad!',
      order_body:
        'Tack för din beställning. En bekräftelse har skickats till din e-postadress.',
      order_number: 'Ordernummer',
      from_quotation: 'Beställd från offert {number}',
      view_quotation: 'Visa offerten i kundportalen',
      continue_shopping: 'Fortsätt handla',
    });
    expect(messages('sv').portal.quotations.order_row).toBe('Order');
  });

  it.each(LOCALES)('keeps the quotation number in the sentence in %s', (l) => {
    expect(messages(l).portal.quotations.confirm.from_quotation).toContain(
      '{number}',
    );
  });

  it.each(LOCALES)('has no copy left for the old confirmation in %s', (l) => {
    const quote = messages(l).quote ?? {};
    for (const key of [
      'confirmation_title',
      'confirmation_message',
      'quote_number',
      'back_to_portal',
    ]) {
      expect(quote).not.toHaveProperty(key);
    }
  });
});
