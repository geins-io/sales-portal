import { describe, it, expect } from 'vitest';
import {
  productPath,
  categoryPath,
  brandPath,
  stripTypePrefix,
  alternateEntityPath,
} from '#shared/utils/route-helpers';

/**
 * Contract / invariant tests for shared/utils/route-helpers.
 *
 * These tests lock behavioral properties (idempotency, no double-prefix,
 * safe null returns) that example-based tests alone cannot guarantee. All
 * inputs are fixed so failures are fully reproducible.
 */

// ---------------------------------------------------------------------------
// Idempotency: f(f(x)) === f(x) for a representative input table
// ---------------------------------------------------------------------------

describe('productPath idempotency', () => {
  const cases = [
    { label: 'bare alias (no slash)', input: 'bare-alias', expected: '/p/bare-alias' },
    { label: 'already /p/-prefixed', input: '/p/x', expected: '/p/x' },
    {
      label: 'market/locale + /p/ prefix',
      input: '/se/sv/p/cat/item',
      expected: '/p/cat/item',
    },
    {
      label: 'multi-segment without prefix',
      input: '/cat/sub/product',
      expected: '/p/cat/sub/product',
    },
  ];

  for (const { label, input, expected } of cases) {
    it(`is idempotent for: ${label}`, () => {
      expect(productPath(input)).toBe(expected);
      expect(productPath(productPath(input))).toBe(expected);
    });
  }
});

describe('categoryPath idempotency', () => {
  const cases = [
    { label: 'already /c/-prefixed', input: '/c/tools', expected: '/c/tools' },
    {
      label: 'Geins /l/ prefix is stripped to /c/',
      input: '/se/sv/l/tools',
      expected: '/c/tools',
    },
    {
      label: 'multi-segment without prefix',
      input: '/tools/sub',
      expected: '/c/tools/sub',
    },
  ];

  for (const { label, input, expected } of cases) {
    it(`is idempotent for: ${label}`, () => {
      expect(categoryPath(input)).toBe(expected);
      expect(categoryPath(categoryPath(input))).toBe(expected);
    });
  }
});

describe('brandPath idempotency', () => {
  const cases = [
    { label: 'already /b/-prefixed', input: '/b/brand-x', expected: '/b/brand-x' },
    {
      label: 'market/locale-prefixed without type',
      input: '/se/sv/brand-x',
      expected: '/b/brand-x',
    },
  ];

  for (const { label, input, expected } of cases) {
    it(`is idempotent for: ${label}`, () => {
      expect(brandPath(input)).toBe(expected);
      expect(brandPath(brandPath(input))).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// No double-prefix: already-typed paths are not double-prefixed
// ---------------------------------------------------------------------------

describe('no double-prefix', () => {
  it('productPath("/p/x") returns "/p/x" not "/p/p/x"', () => {
    expect(productPath('/p/x')).toBe('/p/x');
  });

  it('categoryPath("/c/x") returns "/c/x" not "/c/c/x"', () => {
    expect(categoryPath('/c/x')).toBe('/c/x');
  });

  it('brandPath("/b/x") returns "/b/x" not "/b/b/x"', () => {
    expect(brandPath('/b/x')).toBe('/b/x');
  });

  it('productPath strips a mismatched /l/ rather than prepending /p/ on top', () => {
    // Geins list prefix must be stripped and replaced, not stacked.
    expect(productPath('/se/sv/l/some-list/product')).toBe('/p/some-list/product');
    expect(productPath('/p/some-list/product')).toBe('/p/some-list/product');
  });
});

// ---------------------------------------------------------------------------
// alternateEntityPath: 3rd segment is always in {p, c, b} and never 'l'/'dc'
// ---------------------------------------------------------------------------

describe('alternateEntityPath never emits a non-routable 3rd segment', () => {
  const neverAllowed = new Set(['l', 'dc']);
  const allowedPrefixes = new Set(['p', 'c', 'b']);

  const crossTypeCases: Array<{
    label: string;
    url: string;
    type: 'product' | 'category' | 'brand';
    expected: string;
  }> = [
    {
      label: '/l/ input + product type -> /p/',
      url: '/se/en/l/x',
      type: 'product',
      expected: '/se/en/p/x',
    },
    {
      label: '/dc/ input + brand type -> /b/',
      url: '/se/en/dc/x',
      type: 'brand',
      expected: '/se/en/b/x',
    },
    {
      label: '/l/ input + category type -> /c/',
      url: '/se/en/l/x',
      type: 'category',
      expected: '/se/en/c/x',
    },
    {
      label: 'no-prefix input + product type -> /p/',
      url: '/se/en/materials/item',
      type: 'product',
      expected: '/se/en/p/materials/item',
    },
    {
      label: '/p/ input + product type -> /p/ (unchanged)',
      url: '/se/en/p/cat/item',
      type: 'product',
      expected: '/se/en/p/cat/item',
    },
  ];

  for (const { label, url, type, expected } of crossTypeCases) {
    it(label, () => {
      const result = alternateEntityPath(url, type);
      expect(result).toBe(expected);

      // Property: 3rd segment must be in {p, c, b} and never 'l' or 'dc'.
      if (result !== null) {
        const segments = result.split('/').filter(Boolean);
        const thirdSegment = segments[2];
        expect(
          neverAllowed.has(thirdSegment!),
          `3rd segment must not be 'l' or 'dc', got: ${thirdSegment}`,
        ).toBe(false);
        expect(
          allowedPrefixes.has(thirdSegment!),
          `3rd segment must be in {p, c, b}, got: ${thirdSegment}`,
        ).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// alternateEntityPath: preserves the input's own market/locale (not current)
// ---------------------------------------------------------------------------

describe('alternateEntityPath preserves the input market/locale', () => {
  it('keeps "en" locale from the alternate URL, not the caller locale', () => {
    // If current locale were "sv", this must still return /se/en/c/x.
    expect(alternateEntityPath('/se/en/l/x', 'category')).toBe('/se/en/c/x');
  });

  it('keeps "sv" locale from the alternate URL', () => {
    expect(
      alternateEntityPath('/se/sv/material/grenror/grenror-150-150-88', 'product'),
    ).toBe('/se/sv/p/material/grenror/grenror-150-150-88');
  });
});

// ---------------------------------------------------------------------------
// alternateEntityPath: null on unsafe / unroutable inputs
// ---------------------------------------------------------------------------

describe('alternateEntityPath returns null for unsafe inputs', () => {
  it('rejects absolute https URL', () => {
    expect(alternateEntityPath('https://evil.example/x', 'product')).toBeNull();
  });

  it('rejects absolute http URL', () => {
    expect(alternateEntityPath('http://evil.example/x', 'product')).toBeNull();
  });

  it('rejects protocol-relative URL (//)', () => {
    expect(alternateEntityPath('//evil/x', 'product')).toBeNull();
  });

  it('rejects path with no leading slash', () => {
    expect(alternateEntityPath('cutting-edge', 'product')).toBeNull();
  });

  it('rejects path with too few segments (only market/locale)', () => {
    expect(alternateEntityPath('/se/en', 'product')).toBeNull();
  });

  it('rejects uppercase market segment (non-2-letter-lowercase)', () => {
    expect(alternateEntityPath('/SE/en/x', 'product')).toBeNull();
  });

  it('rejects uppercase locale segment', () => {
    expect(alternateEntityPath('/se/EN/x', 'product')).toBeNull();
  });

  it('rejects over-length market segment (e.g. "sweden")', () => {
    expect(alternateEntityPath('/sweden/en/x', 'product')).toBeNull();
  });

  it('rejects backslash-leading authority (/\\evil.com/x) to block open-redirect bypass', () => {
    // The backslash means segment[0] is not 2 lowercase letters so the
    // market regex rejects it. Defense-in-depth: locks the property even if
    // the explicit startsWith check above were removed.
    expect(alternateEntityPath('/\\evil.com/x', 'product')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(alternateEntityPath(123 as unknown as string, 'product')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// stripTypePrefix round-trip
// ---------------------------------------------------------------------------

describe('stripTypePrefix round-trip', () => {
  it('strips /p/ back to the original slug', () => {
    expect(stripTypePrefix(productPath('/x'))).toBe('/x');
  });

  it('strips /c/ back to the original slug', () => {
    expect(stripTypePrefix(categoryPath('/tools'))).toBe('/tools');
  });

  it('strips /b/ back to the original slug', () => {
    expect(stripTypePrefix(brandPath('/brand'))).toBe('/brand');
  });

  it('strips /p/ from a multi-segment product path', () => {
    expect(stripTypePrefix(productPath('/cat/sub/product'))).toBe(
      '/cat/sub/product',
    );
  });
});
