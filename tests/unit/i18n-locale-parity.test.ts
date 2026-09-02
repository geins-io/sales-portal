/**
 * Locale file parity: every *.json in app/locales must have exactly the
 * key set that en.json (the source locale) has. Complements
 * i18n-organisation-keys.test.ts, which checks keys referenced from code.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LOCALES_DIR = resolve(__dirname, '../../app/locales');
const SOURCE_LOCALE = 'en.json';

function loadLocaleFile(file: string): Record<string, unknown> {
  const raw = readFileSync(join(LOCALES_DIR, file), 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe('i18n locale file key parity', () => {
  const localeFiles = readdirSync(LOCALES_DIR).filter((f) =>
    f.endsWith('.json'),
  );

  it(`found locale files including ${SOURCE_LOCALE}`, () => {
    expect(localeFiles).toContain(SOURCE_LOCALE);
    expect(localeFiles.length).toBeGreaterThan(1);
  });

  const sourceKeys = new Set(flattenKeys(loadLocaleFile(SOURCE_LOCALE)));

  for (const file of localeFiles.filter((f) => f !== SOURCE_LOCALE)) {
    describe(file, () => {
      const keys = new Set(flattenKeys(loadLocaleFile(file)));

      it(`has every key ${SOURCE_LOCALE} has`, () => {
        const missing = [...sourceKeys].filter((k) => !keys.has(k)).sort();
        expect(
          missing,
          `${file} is missing keys present in ${SOURCE_LOCALE}: ${missing.join(', ')}`,
        ).toEqual([]);
      });

      it(`has no keys ${SOURCE_LOCALE} lacks`, () => {
        const extra = [...keys].filter((k) => !sourceKeys.has(k)).sort();
        expect(
          extra,
          `${file} has extra keys not present in ${SOURCE_LOCALE}: ${extra.join(', ')}`,
        ).toEqual([]);
      });
    });
  }
});
