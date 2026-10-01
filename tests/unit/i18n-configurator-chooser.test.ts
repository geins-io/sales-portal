/**
 * The chooser's prompts sit right under the group's heading, so they carry no
 * group name; the panel's title is read with the heading out of sight, so it
 * does. A locale that puts `{name}` back into a prompt repeats the heading.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LOCALES = resolve(__dirname, '../../app/locales');

const configurator = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(LOCALES, file), 'utf-8')).configurator;

const files = readdirSync(LOCALES).filter((file) => file.endsWith('.json'));

describe('configurator chooser texts', () => {
  it('covers all six locales', () => {
    expect(files).toHaveLength(6);
  });

  for (const file of files) {
    it(`${file}: the prompts leave the group name out, the panel title keeps it`, () => {
      const texts = configurator(file);

      expect(texts.choose).toEqual(expect.any(String));
      expect(texts.choose).not.toContain('{name}');
      expect(texts.add_more).toEqual(expect.any(String));
      expect(texts.add_more).not.toContain('{name}');
      expect(texts.choose_in_group).toContain('{name}');
    });
  }
});
