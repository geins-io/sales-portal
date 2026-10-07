import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

const LOCALES = resolve(import.meta.dirname, '../../app/locales');

/**
 * A key's text in the language the page renders, read from the app's own
 * locale file, so the assertion holds in every language a tenant runs.
 */
export async function localeText(page: Page, key: string): Promise<string> {
  const language = await page.evaluate(() => document.documentElement.lang);
  const file = resolve(LOCALES, `${language.slice(0, 2)}.json`);
  const text = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      JSON.parse(readFileSync(file, 'utf8')),
    );
  if (typeof text !== 'string') {
    throw new Error(`${key} has no text in ${file}`);
  }
  return text;
}
