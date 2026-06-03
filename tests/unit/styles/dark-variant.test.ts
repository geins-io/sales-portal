import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cssSource = readFileSync(
  resolve(__dirname, '../../../app/assets/css/tailwind.css'),
  'utf-8',
);

describe('tailwind.css dark variant binding', () => {
  it('binds the dark: variant to a never-present .dark class, not prefers-color-scheme', () => {
    // The dark: variant must be redefined to key off a .dark class so it stays
    // inert in this light-only app. Tailwind v4's default ties dark: to the
    // prefers-color-scheme media query, which would render shadcn base
    // components off-spec for dark-OS users.
    expect(cssSource).toContain('@custom-variant dark');
    expect(cssSource).toMatch(/@custom-variant dark\s*\([^)]*\.dark[^)]*\)/);
  });
});
