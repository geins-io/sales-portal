import { describe, it, expect } from 'vitest';
import { lookupHostname } from '../../../server/utils/lookup-hostname';

/**
 * The function reads nothing but its argument — no mode, no config — so these
 * cases are the whole contract. That it stays on in a production build is
 * proved where it can actually be observed: "rewrites with dev mode off too"
 * in tests/server/plugins/02.tenant-context.test.ts.
 */

describe('lookupHostname', () => {
  it('rewrites a .litium.test host to .litium.store', () => {
    expect(lookupHostname('example.litium.test')).toBe('example.litium.store');
  });

  it('leaves a host that does not end in .litium.test untouched', () => {
    for (const hostname of [
      'example.litium.store',
      'example.sales-portal.geins.dev',
      'shop.example.com',
      'localhost',
    ]) {
      expect(lookupHostname(hostname), hostname).toBe(hostname);
    }
  });

  it('matches the suffix at the end only', () => {
    // The suffix appears, but the host belongs to someone else.
    expect(lookupHostname('litium.test.example.com')).toBe(
      'litium.test.example.com',
    );
    // The bare domain carries no tenant name to rewrite.
    expect(lookupHostname('litium.test')).toBe('litium.test');
  });

  it('swaps only the tail of a deeper name', () => {
    expect(lookupHostname('preview.example.litium.test')).toBe(
      'preview.example.litium.store',
    );
  });
});
