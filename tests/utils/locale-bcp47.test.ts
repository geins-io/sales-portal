import { describe, it, expect } from 'vitest';
import { findTenantBcp47 } from '../../app/utils/locale-bcp47';

describe('findTenantBcp47', () => {
  const locales = ['sv-SE', 'en-GB', 'nb-NO', 'fi-FI', 'da-DK'];

  it('resolves a short code to the tenant tag with that language prefix', () => {
    expect(findTenantBcp47('en', locales)).toBe('en-GB');
    expect(findTenantBcp47('nb', locales)).toBe('nb-NO');
  });

  it('returns the tenant variant, not a fixed region', () => {
    expect(findTenantBcp47('en', ['en-US'])).toBe('en-US');
  });

  it('returns undefined when no tenant locale carries the prefix', () => {
    expect(findTenantBcp47('de', locales)).toBeUndefined();
  });

  it('matches on the prefix only, so a full tag as input does not match itself', () => {
    // Callers pass the short URL code; a value that is already a full tag has
    // no prefix match and must fall through to the caller's own fallback.
    expect(findTenantBcp47('sv-SE', locales)).toBeUndefined();
  });

  it('returns undefined for an absent or empty locale list', () => {
    expect(findTenantBcp47('sv', undefined)).toBeUndefined();
    expect(findTenantBcp47('sv', [])).toBeUndefined();
  });
});
