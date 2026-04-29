import { describe, it, expect } from 'vitest';
import { hasUrlLocalePrefix } from '../../app/plugins/i18n-locale';

/**
 * Regression: tenant-default locale watch must NOT override the URL
 * locale on prefixed routes. Hard refresh on PLP/PDP/category pages
 * 404s when this guard is missing — useFetch sends `?locale=<wrong>`
 * during SSR.
 */
describe('hasUrlLocalePrefix', () => {
  it('detects locale via route params (set by pages:extend)', () => {
    expect(
      hasUrlLocalePrefix({
        params: { market: 'se', locale: 'sv' },
        path: '/se/sv/c/material',
      }),
    ).toBe(true);
  });

  it('detects locale via raw URL segments when params are empty', () => {
    expect(hasUrlLocalePrefix({ params: {}, path: '/se/en/p/x/y/z' })).toBe(
      true,
    );
  });

  it('returns false for the bare root', () => {
    expect(hasUrlLocalePrefix({ params: {}, path: '/' })).toBe(false);
  });

  it('returns false for unprefixed page paths', () => {
    expect(hasUrlLocalePrefix({ params: {}, path: '/cart' })).toBe(false);
    expect(hasUrlLocalePrefix({ params: {}, path: '/checkout' })).toBe(false);
  });

  it('returns false for paths whose first segments are not 2-letter codes', () => {
    expect(hasUrlLocalePrefix({ params: {}, path: '/portal/orders' })).toBe(
      false,
    );
    expect(hasUrlLocalePrefix({ params: {}, path: '/api/products/abc' })).toBe(
      false,
    );
  });

  it('treats non-string locale params as missing', () => {
    expect(
      hasUrlLocalePrefix({
        params: { locale: undefined },
        path: '/cart',
      }),
    ).toBe(false);
  });
});
