import { describe, it, expect } from 'vitest';
import {
  hasLocaleMarketPrefix,
  parseLocaleMarketPrefix,
  stripLocaleMarketPrefix,
  normalizeSlugToPath,
  extractShortLocales,
  resolveLocaleMarket,
  swapMarketInPath,
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

describe('parseLocaleMarketPrefix', () => {
  it('returns the market and locale for a prefixed path', () => {
    expect(parseLocaleMarketPrefix('/se/en/c/categoryone')).toEqual({
      market: 'se',
      locale: 'en',
    });
  });

  it('returns the codes for just the prefix segments', () => {
    expect(parseLocaleMarketPrefix('/no/sv')).toEqual({
      market: 'no',
      locale: 'sv',
    });
  });

  it('strips query string and hash before parsing', () => {
    expect(parseLocaleMarketPrefix('/se/en/c/foo?ref=1#top')).toEqual({
      market: 'se',
      locale: 'en',
    });
  });

  it('returns null for a prefix-less single segment', () => {
    expect(parseLocaleMarketPrefix('/grenror')).toBeNull();
  });

  it('returns null for a multi-segment path with no 2-letter prefix', () => {
    expect(parseLocaleMarketPrefix('/material/grenror')).toBeNull();
  });

  it('returns null for the root path', () => {
    expect(parseLocaleMarketPrefix('/')).toBeNull();
  });

  it('returns null for uppercase segments', () => {
    expect(parseLocaleMarketPrefix('/SE/EN/foo')).toBeNull();
  });

  it('agrees with hasLocaleMarketPrefix', () => {
    for (const p of [
      '/se/en/c/foo',
      '/grenror',
      '/material/grenror',
      '/',
      '/se',
    ]) {
      expect(parseLocaleMarketPrefix(p) !== null).toBe(
        hasLocaleMarketPrefix(p),
      );
    }
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

describe('swapMarketInPath', () => {
  it('swaps the market segment on a deep path', () => {
    expect(swapMarketInPath('/se/sv/portal', 'fi')).toBe('/fi/sv/portal');
  });

  it('preserves the trailing slash on prefix-only paths', () => {
    expect(swapMarketInPath('/se/sv/', 'no')).toBe('/no/sv/');
  });

  it('preserves the locale and the deep path tail', () => {
    expect(swapMarketInPath('/se/en/c/foo/bar', 'dk')).toBe('/dk/en/c/foo/bar');
  });

  it('preserves trailing slash on deep paths', () => {
    expect(swapMarketInPath('/se/sv/portal/orders/', 'fi')).toBe(
      '/fi/sv/portal/orders/',
    );
  });

  it('falls back to sv locale when path lacks a locale segment', () => {
    expect(swapMarketInPath('/se', 'fi')).toBe('/fi/sv');
  });
});

// B13 regression — locale-market parsing must be stable for paths whose
// later segments contain UUIDs (hyphen-rich strings). See spec 002.
describe('locale-market parsing — path with UUID segment', () => {
  const tenantConfig = {
    availableLocales: ['sv-SE', 'en-US'],
    availableMarkets: ['se', 'us'],
    defaultLocale: 'sv-SE',
    defaultMarket: 'se',
  };
  const uuidPath =
    '/se/sv/portal/quotations/de305d54-75b4-431b-adb2-eb6b9e546014';

  it('hasLocaleMarketPrefix returns true for /se/sv/portal/quotations/<UUID>', () => {
    expect(hasLocaleMarketPrefix(uuidPath)).toBe(true);
  });

  it('stripLocaleMarketPrefix strips only first two segments, preserving UUID', () => {
    expect(stripLocaleMarketPrefix(uuidPath)).toBe(
      '/portal/quotations/de305d54-75b4-431b-adb2-eb6b9e546014',
    );
  });

  it('resolveLocaleMarket yields market=se, locale=sv regardless of later segments', () => {
    const { resolved, corrected } = resolveLocaleMarket(
      { market: 'se', locale: 'sv' },
      tenantConfig,
    );
    expect(resolved.market).toBe('se');
    expect(resolved.locale).toBe('sv');
    expect(resolved.localeBcp47).toBe('sv-SE');
    expect(corrected).toBe(false);
  });
});
