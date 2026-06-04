import { describe, it, expect } from 'vitest';
import {
  categoryPath,
  productPath,
  brandPath,
  searchPath,
  discountCampaignPath,
  stripTypePrefix,
  detectRouteType,
  alternateEntityPath,
} from '../../shared/utils/route-helpers';

describe('categoryPath', () => {
  it('strips market/locale prefix and adds /c/', () => {
    expect(categoryPath('/se/sv/material/epoxy')).toBe('/c/material/epoxy');
  });

  it('adds /c/ when no market/locale prefix', () => {
    expect(categoryPath('/material/epoxy')).toBe('/c/material/epoxy');
  });

  it('does not double the prefix when canonical URL already includes /c/ or /l/', () => {
    expect(categoryPath('/se/sv/l/kategori-1')).toBe('/c/kategori-1');
    expect(categoryPath('/se/sv/c/kategori-1')).toBe('/c/kategori-1');
  });

  it('handles locale with region code', () => {
    expect(categoryPath('/se/sv-se/material')).toBe('/c/material');
  });

  it('handles root-level category', () => {
    expect(categoryPath('/se/sv/tools')).toBe('/c/tools');
  });
});

describe('productPath', () => {
  it('strips market/locale prefix and adds /p/', () => {
    expect(productPath('/se/sv/cat/product-name')).toBe('/p/cat/product-name');
  });

  it('adds /p/ when no market/locale prefix', () => {
    expect(productPath('/cat/product-name')).toBe('/p/cat/product-name');
  });

  it('handles deeply nested product path', () => {
    expect(productPath('/se/en/a/b/c/product')).toBe('/p/a/b/c/product');
  });

  it('does not double the prefix when the canonical URL already includes /p/', () => {
    expect(productPath('/se/sv/p/kategori-1/wood-screw-se')).toBe(
      '/p/kategori-1/wood-screw-se',
    );
    expect(productPath('/se/en/p/category-1/wood-screw-en')).toBe(
      '/p/category-1/wood-screw-en',
    );
  });

  it('rewrites a mismatched upstream type prefix (e.g. /l/) to /p/', () => {
    expect(productPath('/se/sv/l/some-list/product')).toBe(
      '/p/some-list/product',
    );
  });

  it('tolerates a bare alias with no leading slash', () => {
    expect(productPath('manifold-x')).toBe('/p/manifold-x');
  });

  it('is idempotent for an already-prefixed path', () => {
    expect(productPath('/p/manifold-x')).toBe('/p/manifold-x');
  });
});

describe('brandPath', () => {
  it('strips market/locale prefix and adds /b/', () => {
    expect(brandPath('/se/sv/our-company')).toBe('/b/our-company');
  });

  it('adds /b/ when no market/locale prefix', () => {
    expect(brandPath('/our-company')).toBe('/b/our-company');
  });
});

describe('searchPath', () => {
  it('builds /s/ path with query', () => {
    expect(searchPath('epoxy')).toBe('/s/epoxy');
  });

  it('encodes special characters in query', () => {
    expect(searchPath('hello world')).toBe('/s/hello%20world');
  });

  it('encodes unicode characters', () => {
    expect(searchPath('skruv & mutter')).toBe('/s/skruv%20%26%20mutter');
  });
});

describe('discountCampaignPath', () => {
  it('strips market/locale prefix and adds /dc/', () => {
    expect(discountCampaignPath('/se/sv/summer-sale')).toBe('/dc/summer-sale');
  });

  it('adds /dc/ when no market/locale prefix', () => {
    expect(discountCampaignPath('/summer-sale')).toBe('/dc/summer-sale');
  });
});

describe('stripTypePrefix', () => {
  it('strips /c/ prefix', () => {
    expect(stripTypePrefix('/c/material/epoxy')).toBe('/material/epoxy');
  });

  it('strips /p/ prefix', () => {
    expect(stripTypePrefix('/p/cat/product')).toBe('/cat/product');
  });

  it('strips /b/ prefix', () => {
    expect(stripTypePrefix('/b/our-company')).toBe('/our-company');
  });

  it('strips /s/ prefix', () => {
    expect(stripTypePrefix('/s/query')).toBe('/query');
  });

  it('strips /dc/ prefix', () => {
    expect(stripTypePrefix('/dc/summer-sale')).toBe('/summer-sale');
  });

  it('returns path unchanged when no known prefix', () => {
    expect(stripTypePrefix('/about-us')).toBe('/about-us');
  });

  it('handles prefix-only path returning root', () => {
    expect(stripTypePrefix('/c')).toBe('/');
  });
});

describe('detectRouteType', () => {
  it('detects category from "c"', () => {
    expect(detectRouteType('c')).toBe('category');
  });

  it('detects product from "p"', () => {
    expect(detectRouteType('p')).toBe('product');
  });

  it('detects brand from "b"', () => {
    expect(detectRouteType('b')).toBe('brand');
  });

  it('detects search from "s"', () => {
    expect(detectRouteType('s')).toBe('search');
  });

  it('detects discountCampaign from "dc"', () => {
    expect(detectRouteType('dc')).toBe('discountCampaign');
  });

  it('detects list from "l"', () => {
    expect(detectRouteType('l')).toBe('list');
  });

  it('returns null for unknown segment', () => {
    expect(detectRouteType('unknown')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectRouteType('')).toBeNull();
  });
});

describe('alternateEntityPath', () => {
  it('remaps /l/ Geins category alternate to /c/ app route', () => {
    expect(alternateEntityPath('/se/en/l/category-1', 'category')).toBe(
      '/se/en/c/category-1',
    );
  });

  it('injects /p/ into a prefix-less product path while preserving market+locale', () => {
    expect(
      alternateEntityPath(
        '/se/en/materials/branch-pipes/manifold-150-150-88',
        'product',
      ),
    ).toBe('/se/en/p/materials/branch-pipes/manifold-150-150-88');
  });

  it('leaves an already-prefixed /p/ path unchanged (no /p/p/)', () => {
    expect(
      alternateEntityPath('/se/en/p/category-1/cutting-edge', 'product'),
    ).toBe('/se/en/p/category-1/cutting-edge');
  });

  it('injects /c/ into a prefix-less category path', () => {
    expect(
      alternateEntityPath('/se/en/materials/branch-pipes', 'category'),
    ).toBe('/se/en/c/materials/branch-pipes');
  });

  it('injects /b/ into a prefix-less brand path', () => {
    expect(alternateEntityPath('/se/en/our-company', 'brand')).toBe(
      '/se/en/b/our-company',
    );
  });

  it('preserves the alternate own locale when different from current (sv alternate)', () => {
    expect(
      alternateEntityPath(
        '/se/sv/material/grenror/grenror-150-150-88',
        'product',
      ),
    ).toBe('/se/sv/p/material/grenror/grenror-150-150-88');
  });

  it('rejects absolute http URL', () => {
    expect(alternateEntityPath('https://evil.example/x', 'product')).toBeNull();
  });

  it('rejects protocol-relative URL', () => {
    expect(alternateEntityPath('//evil/x', 'product')).toBeNull();
  });

  it('rejects path with no leading slash', () => {
    expect(alternateEntityPath('cutting-edge', 'product')).toBeNull();
  });

  it('rejects path with too few segments', () => {
    expect(alternateEntityPath('/se/en', 'product')).toBeNull();
  });

  it('rejects non-2-letter market/locale segments', () => {
    expect(alternateEntityPath('/SE/EN/x', 'product')).toBeNull();
    expect(alternateEntityPath('/sweden/en/x', 'product')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(alternateEntityPath(123 as unknown as string, 'product')).toBeNull();
  });

  it('drops query string and hash before processing', () => {
    expect(
      alternateEntityPath('/se/en/l/category-1?foo=bar#section', 'category'),
    ).toBe('/se/en/c/category-1');
  });

  it('without opts preserves the url own market/locale (alternates behaviour)', () => {
    expect(alternateEntityPath('/se/sv/c/kabel', 'category')).toBe(
      '/se/sv/c/kabel',
    );
  });

  it('opts override the output locale while keeping the slug tail (recovery)', () => {
    expect(
      alternateEntityPath('/se/sv/c/kabel', 'category', { locale: 'en' }),
    ).toBe('/se/en/c/kabel');
  });

  it('opts override on a Geins /l/ input remaps to /c/ in the requested locale', () => {
    expect(
      alternateEntityPath('/se/sv/l/kabel', 'category', {
        market: 'se',
        locale: 'en',
      }),
    ).toBe('/se/en/c/kabel');
  });

  it('a malformed override value falls back to the url own segment', () => {
    expect(
      alternateEntityPath('/se/sv/c/kabel', 'category', { locale: 'english' }),
    ).toBe('/se/sv/c/kabel');
  });

  it('still returns null for too-few-segment input even with opts', () => {
    expect(
      alternateEntityPath('/se/en', 'product', { locale: 'sv' }),
    ).toBeNull();
  });
});
