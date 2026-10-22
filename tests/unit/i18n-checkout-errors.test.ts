/**
 * The checkout banner shows `t(checkoutStore.error)`, so every key the store
 * can hold must exist in every locale, translated rather than copied from en.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LOCALES = resolve(__dirname, '../../app/locales');
const KEYS = [
  'order_failed',
  'load_failed',
  'quote_failed',
  'invalid_identity_number',
] as const;

const raw = (file: string): string =>
  readFileSync(join(LOCALES, file), 'utf-8');
const errors = (file: string): Record<string, unknown> =>
  JSON.parse(raw(file)).checkout.error;
/** The top-level `checkout` object as written, up to its closing brace at two spaces. */
const checkoutBlock = (file: string): string => {
  const text = raw(file);
  const start = text.indexOf('\n  "checkout": {');
  return text.slice(start, text.indexOf('\n  }', start));
};

const files = readdirSync(LOCALES).filter((file) => file.endsWith('.json'));

describe('checkout error reasons', () => {
  it('covers all six locales', () => {
    expect(files).toHaveLength(6);
  });

  it('reads the agreed text in sv and en', () => {
    expect(errors('sv.json')).toEqual({
      order_failed: 'Ordern kunde inte läggas. Försök igen eller kontakta oss.',
      load_failed: 'Kassan kunde inte laddas. Försök igen.',
      quote_failed: 'Offertförfrågan kunde inte skickas. Försök igen.',
      invalid_identity_number:
        'Person- eller organisationsnumret godkändes inte. Kontrollera det och försök igen.',
    });
    expect(errors('en.json')).toEqual({
      order_failed: 'The order could not be placed. Try again or contact us.',
      load_failed: 'The checkout could not be loaded. Try again.',
      quote_failed: 'The quote request could not be sent. Try again.',
      invalid_identity_number:
        'The personal or organisation number was not accepted. Check it and try again.',
    });
  });

  for (const file of files) {
    for (const key of KEYS) {
      it(`${file}: checkout.error.${key} is a translated sentence`, () => {
        const value = errors(file)[key];

        expect(value).toEqual(expect.any(String));
        expect(value).toMatch(/\.$/);
        if (file !== 'en.json') expect(value).not.toBe(errors('en.json')[key]);
      });

      // JSON.parse keeps the last of two equal keys without a word, so a
      // second copy would silently replace the text tested above.
      it(`${file}: declares "${key}" once in checkout`, () => {
        expect(checkoutBlock(file).split(`"${key}":`)).toHaveLength(2);
      });
    }
  }
});
