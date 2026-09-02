import { describe, it, expect } from 'vitest';
import { findTenantBcp47, hreflangFor } from '../../app/utils/locale-bcp47';

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

describe('hreflangFor', () => {
  const locales = ['sv-SE', 'en-GB', 'nb-NO', 'fi-FI', 'da-DK'];

  it('uses the market as the region subtag, upper-cased', () => {
    expect(hreflangFor('nb', 'se', locales)).toBe('nb-SE');
    expect(hreflangFor('sv', 'se', locales)).toBe('sv-SE');
  });

  it('follows the market rather than the locale home region', () => {
    expect(hreflangFor('sv', 'fi', locales)).toBe('sv-FI');
    expect(hreflangFor('en', 'fi', locales)).toBe('en-FI');
    expect(hreflangFor('nb', 'fi', locales)).toBe('nb-FI');
    expect(hreflangFor('da', 'fi', locales)).toBe('da-FI');
  });

  it('falls back to the tenant tag when the market is not an ISO region', () => {
    // 'eu' is reserved, not assigned, so 'sv-EU' must never be emitted.
    expect(hreflangFor('sv', 'eu', locales)).toBe('sv-SE');
    expect(hreflangFor('en', 'eu', locales)).toBe('en-GB');
    expect(hreflangFor('nb', 'eu', locales)).toBe('nb-NO');
  });

  it('falls back to the bare short code when neither market nor tenant helps', () => {
    expect(hreflangFor('de', 'eu', locales)).toBe('de');
    expect(hreflangFor('sv', 'eu', ['sv'])).toBe('sv');
    expect(hreflangFor('sv', 'eu', undefined)).toBe('sv');
  });

  it('treats a missing or empty market as no region', () => {
    expect(hreflangFor('nb', undefined, locales)).toBe('nb-NO');
    expect(hreflangFor('nb', null, locales)).toBe('nb-NO');
    expect(hreflangFor('nb', '', locales)).toBe('nb-NO');
  });

  it('accepts an already upper-cased market code', () => {
    expect(hreflangFor('sv', 'SE', locales)).toBe('sv-SE');
  });
});
