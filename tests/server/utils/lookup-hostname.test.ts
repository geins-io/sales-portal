import { describe, it, expect } from 'vitest';
import { lookupHostname } from '../../../server/utils/lookup-hostname';

describe('lookupHostname', () => {
  it('rewrites a .litium.portal host to .litium.store', () => {
    expect(lookupHostname('example.litium.portal')).toBe(
      'example.litium.store',
    );
  });

  it('rewrites in every mode, production included', () => {
    // No mode gate: the production build is what CI and E2E_PROD=1 test, and a
    // `.portal` name cannot be resolved from the public internet, so no
    // deployed environment can receive one.
    for (const mode of ['production', 'development', 'test']) {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = mode;
      try {
        expect(lookupHostname('example.litium.portal'), mode).toBe(
          'example.litium.store',
        );
      } finally {
        process.env.NODE_ENV = previous;
      }
    }
  });

  it('leaves a host that does not end in .litium.portal untouched', () => {
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
    expect(lookupHostname('litium.portal.example.com')).toBe(
      'litium.portal.example.com',
    );
    // The bare domain carries no tenant name to rewrite.
    expect(lookupHostname('litium.portal')).toBe('litium.portal');
  });

  it('swaps only the tail of a deeper name', () => {
    expect(lookupHostname('preview.example.litium.portal')).toBe(
      'preview.example.litium.store',
    );
  });
});
