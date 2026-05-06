import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The root app.vue must apply bg-site-background to <body> via useHead.
 * Tested at the source level because mounting the SFC requires NuxtLayout +
 * NuxtPage which only exist in the full Nuxt env. The contract is small:
 * useHead({ bodyAttrs: { class: 'bg-site-background' } }) is called once.
 */
describe('app.vue body class', () => {
  const source = readFileSync(resolve(__dirname, '../../app/app.vue'), 'utf-8');

  it('calls useHead with bodyAttrs.class set to bg-site-background', () => {
    expect(source).toMatch(/useHead\s*\(/);
    expect(source).toContain('bodyAttrs');
    expect(source).toMatch(/class:\s*['"]bg-site-background['"]/);
  });

  it('does not overwrite the body class with a hardcoded color', () => {
    expect(source).not.toMatch(/bodyAttrs:\s*\{\s*class:\s*['"]bg-primary/);
    expect(source).not.toMatch(/bodyAttrs:\s*\{\s*class:\s*['"]bg-background/);
  });
});
