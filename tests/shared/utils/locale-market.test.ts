import { describe, it, expect } from 'vitest';
import {
  hasLocaleMarketPrefix,
  stripLocaleMarketPrefix,
  normalizeSlugToPath,
} from '../../../shared/utils/locale-market';

describe('hasLocaleMarketPrefix', () => {
  it('returns true for a typical market/locale prefix', () => {
    expect(hasLocaleMarketPrefix('/se/sv/foder')).toBe(true);
  });

  it('returns true for just the prefix segments', () => {
    expect(hasLocaleMarketPrefix('/no/en')).toBe(true);
  });

  it('returns false for root path', () => {
    expect(hasLocaleMarketPrefix('/')).toBe(false);
  });

  it('returns false when first segment is longer than 2 chars', () => {
    expect(hasLocaleMarketPrefix('/sweden/sv/foder')).toBe(false);
  });

  it('returns false when second segment is longer than 2 chars', () => {
    expect(hasLocaleMarketPrefix('/se/sve/foder')).toBe(false);
  });

  it('returns false for a single 2-letter segment', () => {
    expect(hasLocaleMarketPrefix('/se')).toBe(false);
  });

  it('returns false for uppercase segments', () => {
    expect(hasLocaleMarketPrefix('/SE/SV/foder')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(hasLocaleMarketPrefix('')).toBe(false);
  });

  it('returns false for paths with numeric segments', () => {
    expect(hasLocaleMarketPrefix('/12/34/page')).toBe(false);
  });
});

describe('stripLocaleMarketPrefix', () => {
  it('strips a standard market/locale prefix', () => {
    expect(stripLocaleMarketPrefix('/se/sv/foder')).toBe('/foder');
  });

  it('strips prefix from deeply nested path', () => {
    expect(stripLocaleMarketPrefix('/no/en/p/category/product')).toBe(
      '/p/category/product',
    );
  });

  it('returns root when path is just prefix with trailing slash', () => {
    expect(stripLocaleMarketPrefix('/se/sv/')).toBe('/');
  });

  it('returns root when path is exactly the prefix', () => {
    expect(stripLocaleMarketPrefix('/se/sv')).toBe('/');
  });

  it('returns unprefixed paths unchanged', () => {
    expect(stripLocaleMarketPrefix('/foder')).toBe('/foder');
  });

  it('returns root unchanged', () => {
    expect(stripLocaleMarketPrefix('/')).toBe('/');
  });

  it('returns empty string unchanged', () => {
    expect(stripLocaleMarketPrefix('')).toBe('');
  });

  it('does not strip when segments are not 2-letter lowercase', () => {
    expect(stripLocaleMarketPrefix('/sweden/sv/foder')).toBe(
      '/sweden/sv/foder',
    );
  });

  it('does not strip uppercase segments', () => {
    expect(stripLocaleMarketPrefix('/SE/SV/foder')).toBe('/SE/SV/foder');
  });
});

describe('normalizeSlugToPath', () => {
  it('normalizes single segment array', () => {
    expect(normalizeSlugToPath(['category'])).toBe('/category');
  });

  it('normalizes multi-segment array', () => {
    expect(normalizeSlugToPath(['category', 'product'])).toBe(
      '/category/product',
    );
  });

  it('returns root for empty array', () => {
    expect(normalizeSlugToPath([])).toBe('/');
  });

  it('filters empty strings', () => {
    expect(normalizeSlugToPath(['category', '', 'product'])).toBe(
      '/category/product',
    );
  });

  it('returns root for undefined', () => {
    expect(normalizeSlugToPath(undefined)).toBe('/');
  });

  it('handles single string input', () => {
    expect(normalizeSlugToPath('category')).toBe('/category');
  });

  it('returns root for empty string', () => {
    expect(normalizeSlugToPath('')).toBe('/');
  });
});
