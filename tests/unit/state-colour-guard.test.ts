import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const RAW_PALETTE =
  /(bg|text|border)-(emerald|green|amber|yellow|orange|lime|red|blue|sky|indigo)-[0-9]/;

// Staff-only banners and a dev page: their colours are not states.
const ALLOWED = new Set([
  'app/assets/css/print.css',
  'app/components/ImpersonationBanner.vue',
  'app/components/PreviewBanner.vue',
  'app/pages/preview-widgets.vue',
]);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

describe('state colours', () => {
  it('come from theme tokens everywhere outside the staff surfaces', () => {
    const offenders = files(join(ROOT, 'app'))
      .map((path) => relative(ROOT, path))
      .filter((path) => !ALLOWED.has(path))
      .filter((path) =>
        RAW_PALETTE.test(readFileSync(join(ROOT, path), 'utf-8')),
      );
    expect(offenders).toEqual([]);
  });
});
