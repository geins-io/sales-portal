import { describe, it, expect } from 'vitest';
import {
  categoryPath,
  productPath,
  brandPath,
  searchPath,
  discountCampaignPath,
  stripTypePrefix,
  detectRouteType,
} from '../../shared/utils/route-helpers';

describe('categoryPath', () => {
  it('strips market/locale prefix and adds /c/', () => {
    expect(categoryPath('/se/sv/material/epoxy')).toBe('/c/material/epoxy');
  });

  it('adds /c/ when no market/locale prefix', () => {
    expect(categoryPath('/material/epoxy')).toBe('/c/material/epoxy');
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
