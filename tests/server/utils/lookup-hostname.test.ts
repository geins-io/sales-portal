import { describe, it, expect } from 'vitest';
import { lookupHostname } from '../../../server/utils/lookup-hostname';

/**
 * The function reads nothing but its argument — no mode, no config — so these
 * cases are the whole contract. That it stays on in a production build is
 * proved where it can actually be observed: "rewrites with dev mode off too"
 * in tests/server/plugins/02.tenant-context.test.ts.
 */

describe('lookupHostname', () => {
  it('leaves hosts outside the local and staging suffixes untouched', () => {
    for (const hostname of [
      'example.litium.store',
      'example.sales-portal.geins.dev',
      'shop.example.com',
      'localhost',
    ]) {
      expect(lookupHostname(hostname), hostname).toBe(hostname);
    }
  });

  describe.each(['litium.test', 'staging.litium.store'])(
    '%s suffix',
    (suffix) => {
      it('rewrites a tenant host to .litium.store', () => {
        expect(lookupHostname(`example.${suffix}`)).toBe(
          'example.litium.store',
        );
      });

      it('matches the suffix at the end only', () => {
        const hostname = `example.${suffix}.example.com`;
        expect(lookupHostname(hostname)).toBe(hostname);
        // The bare domain carries no tenant name to rewrite.
        expect(lookupHostname(suffix)).toBe(suffix);
      });

      it('requires a dot before the suffix', () => {
        const hostname = `example-${suffix}`;
        expect(lookupHostname(hostname)).toBe(hostname);
      });

      it('swaps only the tail of a deeper name', () => {
        expect(lookupHostname(`preview.example.${suffix}`)).toBe(
          'preview.example.litium.store',
        );
      });
    },
  );
});
