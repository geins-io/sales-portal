/**
 * The version texts of a revised quotation: sv/en as the prototype words them,
 * and every locale keeps each text's placeholders.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LOCALES_DIR = resolve(__dirname, '../../app/locales');
const load = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf-8'));
const lookup = (obj: Record<string, unknown>, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (cur, part) =>
        typeof cur === 'object' && cur !== null
          ? (cur as Record<string, unknown>)[part]
          : undefined,
      obj,
    );

const K = 'portal.quotations.';

/** Key, sv, en — sv/en from the prototype's `quotations.revisions.*`. */
const TEXTS: [string, string, string][] = [
  ['version.request', 'Din förfrågan', 'Your request'],
  [
    'status_info_revised',
    'Ersatt av en nyare version ({name}). Den här kan inte besvaras.',
    'Replaced by a newer version ({name}). This one cannot be answered.',
  ],
  ['revisions.label', 'Version', 'Version'],
  [
    'revisions.select_label',
    'Välj version av offerten',
    'Choose a version of the quotation',
  ],
  ['revisions.latest', 'Senaste', 'Latest'],
  [
    'revisions.superseded_title',
    '{name} är ersatt',
    '{name} has been replaced',
  ],
  [
    'revisions.superseded_text',
    'Säljaren har skickat en nyare version ({name}). Du kan läsa den här men inte svara på den.',
    'The seller has sent a newer version ({name}). You can read this one but not answer it.',
  ],
  ['revisions.view_latest', 'Visa senaste versionen', 'View latest version'],
  ['revisions.valid_to', 'gäller t.o.m. {date}', 'valid until {date}'],
  ['revisions.request_sent', 'Skickad', 'Sent'],
  ['revisions.request_title', 'Din förfrågan', 'Your request'],
  [
    'revisions.request_text',
    'Så här såg förfrågan ut när du skickade den {date}. Säljarens offert bygger på den, och priserna här är uppskattade. Den kan inte besvaras.',
    "This is the request as you sent it on {date}. The seller's quotation is based on it, and the prices here are estimates. It cannot be answered.",
  ],
  [
    'revisions.request_status_info',
    'Förfrågan som du skickade. Säljarens offert bygger på den.',
    "The request you sent. The seller's quotation is based on it.",
  ],
  // No send date to show: the prototype's text without it.
  [
    'revisions.request_text_undated',
    'Så här såg förfrågan ut när du skickade den. Säljarens offert bygger på den, och priserna här är uppskattade. Den kan inte besvaras.',
    "This is the request as you sent it. The seller's quotation is based on it, and the prices here are estimates. It cannot be answered.",
  ],
  // A version without a number to show: the status text is the prototype's
  // `status_info.revised`; the notice is worded to match.
  [
    'status_info_revised_unnamed',
    'Ersatt av en nyare version. Den här versionen kan inte besvaras.',
    'Replaced by a newer version. This version cannot be answered.',
  ],
  [
    'revisions.superseded_title_unnamed',
    'Den här versionen är ersatt',
    'This version has been replaced',
  ],
  [
    'revisions.superseded_text_unnamed',
    'Säljaren har skickat en nyare version. Du kan läsa den här men inte svara på den.',
    'The seller has sent a newer version. You can read this one but not answer it.',
  ],
];

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('quotation version texts', () => {
  it.each(TEXTS)('words %s as the prototype does', (key, sv, en) => {
    expect(lookup(load('sv.json'), K + key)).toBe(sv);
    expect(lookup(load('en.json'), K + key)).toBe(en);
  });

  const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));

  describe.each(files)('%s', (file) => {
    const locale = load(file);

    it.each(TEXTS)('has %s with its placeholders', (key, sv) => {
      const text = lookup(locale, K + key);
      expect(typeof text).toBe('string');
      expect((text as string).trim()).not.toBe('');
      expect(placeholders(text as string)).toEqual(placeholders(sv));
    });
  });
});
