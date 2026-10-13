import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// A CMS read that times out has already cost the render its whole budget; the
// GET retry ofetch sends after a 502 would make the page wait for it twice.
// Every useFetch of a /api/cms/ route therefore sends it once.

const APP = join(import.meta.dirname, '../../app');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|vue)$/.test(name) ? [path] : [];
  });
}

/** Each `useFetch(... '/api/cms/...' ..., { ... })` call with its options text. */
function cmsFetches(): { where: string; call: string }[] {
  const found: { where: string; call: string }[] = [];
  for (const file of sources(APP)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/useFetch\b/g)) {
      const start = match.index;
      let depth = 0;
      let end = start;
      for (let i = text.indexOf('(', start); i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')' && --depth === 0) {
          end = i;
          break;
        }
      }
      const call = text.slice(start, end + 1);
      if (/['"`]\/api\/cms\//.test(call)) {
        const line = text.slice(0, start).split('\n').length;
        found.push({ where: `${relative(APP, file)}:${line}`, call });
      }
    }
  }
  return found;
}

describe('CMS reads in the app', () => {
  const fetches = cmsFetches();

  it('are found', () => {
    expect(fetches.length).toBeGreaterThanOrEqual(10);
  });

  it('are each sent once, with no retry', () => {
    const retrying = fetches
      .filter(({ call }) => !/\bretry:\s*0\b/.test(call))
      .map(({ where }) => where);

    expect(retrying).toEqual([]);
  });
});
