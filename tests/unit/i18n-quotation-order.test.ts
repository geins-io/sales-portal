/**
 * The order-from-quotation page's notes, worded as in the prototype.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LOCALES_DIR = resolve(__dirname, '../../app/locales');

function orderCopy(locale: string): Record<string, string> {
  const messages = JSON.parse(
    readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf-8'),
  );
  return messages.portal.quotations.order;
}

describe('order-from-quotation copy', () => {
  it('has the prototype wording in Swedish', () => {
    const sv = orderCopy('sv');
    expect(sv.banner_body).toBe(
      'Priser, antal, frakt och villkor kommer från offerten och kan inte ändras här.',
    );
    expect(sv.addresses_locked).toBe(
      'Adresserna kommer från offerten. Kontakta din säljare om något behöver ändras.',
    );
  });

  it.each(['da', 'de', 'en', 'fi', 'nb', 'sv'])(
    'says where the addresses come from in %s',
    (locale) => {
      expect(orderCopy(locale).addresses_locked).toBeTruthy();
    },
  );
});
