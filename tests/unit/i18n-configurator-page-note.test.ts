/**
 * The note above a configurable product's tabs only points at the tab; price
 * and validity are shown by the panel itself, so the note does not promise them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LOCALES = resolve(__dirname, '../../app/locales');

const pageNote = (file: string): unknown =>
  JSON.parse(readFileSync(join(LOCALES, file), 'utf-8')).configurator.page_note;

const files = readdirSync(LOCALES).filter((file) => file.endsWith('.json'));

describe('configurator page note', () => {
  it('covers all six locales', () => {
    expect(files).toHaveLength(6);
  });

  it('reads the short text in sv and en', () => {
    expect(pageNote('sv.json')).toBe(
      'Detta är en konfiguratorprodukt. Bygg din variant under {tab} nedan.',
    );
    expect(pageNote('en.json')).toBe(
      'This is a configurable product. Build your variant under {tab} below.',
    );
  });

  for (const file of files) {
    it(`${file}: keeps {tab} and ends there, without a second clause`, () => {
      const note = pageNote(file);

      expect(note).toEqual(expect.any(String));
      expect(note).toContain('{tab}');
      expect(note).not.toContain('—');
      expect(note).toMatch(/\.$/);
    });
  }
});
