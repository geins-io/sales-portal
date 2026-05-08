import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configSource = readFileSync(
  resolve(__dirname, '../../nuxt.config.ts'),
  'utf-8',
);

describe('nuxt.config.ts icon configuration', () => {
  it('defines an icon.serverBundle.collections array', () => {
    expect(configSource).toMatch(/icon\s*:/);
    expect(configSource).toMatch(/serverBundle\s*:/);
    expect(configSource).toMatch(/collections\s*:/);
  });

  it('includes lucide in the collections array', () => {
    expect(configSource).toMatch(/collections\s*:\s*\[.*['"]lucide['"].*\]/s);
  });

  it('does not add cdn.jsdelivr.net to connect-src', () => {
    expect(configSource).not.toContain('cdn.jsdelivr.net');
  });
});
