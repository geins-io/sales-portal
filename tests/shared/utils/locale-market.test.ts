import { describe, it, expect } from 'vitest';
import {
  hasLocaleMarketPrefix,
  stripLocaleMarketPrefix,
  normalizeSlugToPath,
  extractShortLocales,
  resolveLocaleMarket,
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

describe('extractShortLocales', () => {
  it('extracts short codes from BCP-47 locale strings', () => {
    const result = extractShortLocales(['sv-SE', 'en-US']);
    expect(result).toEqual(new Set(['sv', 'en']));
  });

  it('returns empty set for empty array', () => {
    const result = extractShortLocales([]);
    expect(result).toEqual(new Set());
  });

  it('skips invalid format entries without a hyphen', () => {
    const result = extractShortLocales(['svSE', 'en-US', 'INVALID']);
    // 'svSE' has no hyphen so split('-')[0] is 'svSE' which is not 2-letter lowercase
    // 'INVALID' split('-')[0] is 'INVALID' which is not 2-letter lowercase
    expect(result).toEqual(new Set(['en']));
  });

  it('handles already-short codes that are 2-letter lowercase', () => {
    // If someone puts just 'sv' in availableLocales, it should still work
    const result = extractShortLocales(['sv', 'en-US']);
    expect(result).toEqual(new Set(['sv', 'en']));
  });
});

describe('resolveLocaleMarket', () => {
  const defaultConfig = {
    availableLocales: ['sv-SE', 'en-US'],
    availableMarkets: ['se', 'no', 'dk'],
    defaultLocale: 'sv-SE',
    defaultMarket: 'se',
  };

  it('returns resolved with corrected=false when both market and locale are valid', () => {
    const result = resolveLocaleMarket(
      { market: 'no', locale: 'en' },
      defaultConfig,
    );
    expect(result.corrected).toBe(false);
    expect(result.resolved).toEqual({
      market: 'no',
      locale: 'en',
      localeBcp47: 'en-US',
    });
  });

  it('falls back to default market when market is invalid, corrected=true', () => {
    const result = resolveLocaleMarket(
      { market: 'xx', locale: 'sv' },
      defaultConfig,
    );
    expect(result.corrected).toBe(true);
    expect(result.resolved.market).toBe('se');
    expect(result.resolved.locale).toBe('sv');
  });

  it('falls back to default locale when locale is invalid, corrected=true', () => {
    const result = resolveLocaleMarket(
      { market: 'no', locale: 'zz' },
      defaultConfig,
    );
    expect(result.corrected).toBe(true);
    expect(result.resolved.locale).toBe('sv');
    expect(result.resolved.market).toBe('no');
  });

  it('falls back to both defaults when both are invalid, corrected=true', () => {
    const result = resolveLocaleMarket(
      { market: 'xx', locale: 'yy' },
      defaultConfig,
    );
    expect(result.corrected).toBe(true);
    expect(result.resolved.market).toBe('se');
    expect(result.resolved.locale).toBe('sv');
  });

  it('expands locale to BCP-47 from availableLocales', () => {
    const result = resolveLocaleMarket(
      { market: 'se', locale: 'sv' },
      defaultConfig,
    );
    expect(result.resolved.localeBcp47).toBe('sv-SE');
  });

  it('expands en to en-US based on availableLocales', () => {
    const result = resolveLocaleMarket(
      { market: 'se', locale: 'en' },
      defaultConfig,
    );
    expect(result.resolved.localeBcp47).toBe('en-US');
  });

  it('uses defaults when availableLocales is empty', () => {
    const result = resolveLocaleMarket(
      { market: 'se', locale: 'sv' },
      {
        ...defaultConfig,
        availableLocales: [],
      },
    );
    // With no available locales, any locale is invalid -> falls back to default
    expect(result.corrected).toBe(true);
    expect(result.resolved.locale).toBe(
      defaultConfig.defaultLocale.split('-')[0],
    );
    expect(result.resolved.localeBcp47).toBe(defaultConfig.defaultLocale);
  });

  it('uses defaults when availableMarkets is empty', () => {
    const result = resolveLocaleMarket(
      { market: 'se', locale: 'sv' },
      {
        ...defaultConfig,
        availableMarkets: [],
      },
    );
    // With no available markets, any market is invalid -> falls back to default
    expect(result.corrected).toBe(true);
    expect(result.resolved.market).toBe(defaultConfig.defaultMarket);
  });

  it('localeBcp47 uses defaultLocale when locale falls back', () => {
    const result = resolveLocaleMarket(
      { market: 'se', locale: 'zz' },
      defaultConfig,
    );
    expect(result.resolved.localeBcp47).toBe('sv-SE');
  });

  it('en matches en-US when en-US appears before en-GB in availableLocales (first match wins)', () => {
    const result = resolveLocaleMarket(
      { market: 'se', locale: 'en' },
      {
        ...defaultConfig,
        availableLocales: ['sv-SE', 'en-US', 'en-GB'],
      },
    );
    expect(result.corrected).toBe(false);
    expect(result.resolved.locale).toBe('en');
    expect(result.resolved.localeBcp47).toBe('en-US');
  });

  it('en matches en-GB when en-GB appears before en-US in availableLocales (first match wins)', () => {
    const result = resolveLocaleMarket(
      { market: 'se', locale: 'en' },
      {
        ...defaultConfig,
        availableLocales: ['sv-SE', 'en-GB', 'en-US'],
      },
    );
    expect(result.corrected).toBe(false);
    expect(result.resolved.locale).toBe('en');
    expect(result.resolved.localeBcp47).toBe('en-GB');
  });
});
