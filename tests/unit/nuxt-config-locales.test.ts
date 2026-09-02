/**
 * The `i18n.locales` array and `SUPPORTED_LOCALE_CODES` are maintained by hand
 * and neither derives from the other, so this guards them against drift.
 *
 * Read as source text, not imported: `defineNuxtConfig` is a Nuxt auto-import
 * that does not exist in a plain unit-test environment.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPPORTED_LOCALE_CODES } from '../../shared/utils/locale-market';

const configSource = readFileSync(
  resolve(__dirname, '../../nuxt.config.ts'),
  'utf-8',
);

/** The `code` of every entry in the i18n `locales: [...]` array. */
function configLocaleCodes(): string[] {
  const block = /i18n\s*:\s*\{[\s\S]*?locales\s*:\s*\[([\s\S]*?)\]/.exec(
    configSource,
  );
  if (!block) return [];
  return [...block[1]!.matchAll(/code\s*:\s*['"]([a-z-]+)['"]/g)].map(
    (m) => m[1]!,
  );
}

describe('nuxt.config.ts i18n locales', () => {
  const codes = configLocaleCodes();

  it('parses a non-empty locales array out of the config', () => {
    expect(codes.length).toBeGreaterThan(0);
  });

  it('declares no locale twice', () => {
    expect(codes).toEqual([...new Set(codes)]);
  });

  it('declares every code in SUPPORTED_LOCALE_CODES', () => {
    const missing = SUPPORTED_LOCALE_CODES.filter((c) => !codes.includes(c));
    expect(
      missing,
      `nuxt.config.ts i18n.locales is missing: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('declares no code absent from SUPPORTED_LOCALE_CODES', () => {
    const supported: readonly string[] = SUPPORTED_LOCALE_CODES;
    const extra = codes.filter((c) => !supported.includes(c));
    expect(
      extra,
      `nuxt.config.ts i18n.locales has codes not in SUPPORTED_LOCALE_CODES: ${extra.join(', ')}`,
    ).toEqual([]);
  });

  it('gives every declared locale a language tag, name and file', () => {
    const entries = [
      ...configSource
        .slice(configSource.indexOf('i18n:'))
        .matchAll(/\{\s*code:\s*['"][a-z-]+['"][^}]*\}/g),
    ].map((m) => m[0]);
    expect(entries.length).toBe(codes.length);
    for (const entry of entries) {
      expect(entry, entry).toMatch(/language\s*:\s*['"][a-zA-Z-]+['"]/);
      expect(entry, entry).toMatch(/name\s*:\s*['"][^'"]+['"]/);
      expect(entry, entry).toMatch(/file\s*:\s*['"][a-z-]+\.json['"]/);
    }
  });
});
