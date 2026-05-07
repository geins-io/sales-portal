/**
 * Parity smoke test: every i18n key consumed by the Organisation feature
 * must exist in both en and sv locale files.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

function loadLocale(lang: string): Record<string, unknown> {
  const raw = readFileSync(join(ROOT, 'app/locales', `${lang}.json`), 'utf-8');
  return JSON.parse(raw);
}

function getNestedValue(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const parts = key.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null || !(p in cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function extractKeys(content: string): string[] {
  const keys = new Set<string>();
  const re = /(?:\$t|(?:i18n\.)?t)\(\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const key = m[1];
    if (key && key.startsWith('portal.org.')) {
      keys.add(key);
    }
  }
  return [...keys];
}

function collectVueFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectVueFiles(full));
      } else if (entry.name.endsWith('.vue')) {
        results.push(full);
      }
    }
  } catch {
    // directory may not exist
  }
  return results;
}

const COMPONENT_PATTERN =
  /OrganisationGeneralSettings|OrganisationPersonsTable|PortalOrganisationShell/;

function collectOrganisationFiles(): string[] {
  const files: string[] = [];
  const pagesDir = join(ROOT, 'app/pages/portal/organisation');
  const componentsDir = join(ROOT, 'app/components/portal');
  files.push(...collectVueFiles(pagesDir));
  files.push(
    ...collectVueFiles(componentsDir).filter((f) => COMPONENT_PATTERN.test(f)),
  );
  return files;
}

describe('i18n organisation key parity', () => {
  const en = loadLocale('en');
  const sv = loadLocale('sv');
  const files = collectOrganisationFiles();

  const allKeys = new Set<string>();
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    for (const key of extractKeys(content)) {
      allKeys.add(key);
    }
  }

  it('found organisation vue files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('found portal.org.* keys to check', () => {
    expect(allKeys.size).toBeGreaterThan(0);
  });

  for (const key of allKeys) {
    it(`en has key: ${key}`, () => {
      expect(
        getNestedValue(en, key),
        `Key "${key}" is missing from en.json`,
      ).toBeDefined();
    });

    it(`sv has key: ${key}`, () => {
      expect(
        getNestedValue(sv, key),
        `Key "${key}" is missing from sv.json`,
      ).toBeDefined();
    });
  }
});
