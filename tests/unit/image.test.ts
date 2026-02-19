import { describe, it, expect } from 'vitest';
import {
  buildGeinsImageUrl,
  buildGeinsImageSrcset,
} from '../../shared/utils/image';

const BASE = 'https://monitor.commerce.services';

describe('buildGeinsImageUrl', () => {
  it('builds a product image URL', () => {
    expect(buildGeinsImageUrl(BASE, 'product', '400x400', 'shoe.jpg')).toBe(
      'https://monitor.commerce.services/product/400x400/shoe.jpg',
    );
  });

  it('encodes the fileName', () => {
    const url = buildGeinsImageUrl(
      BASE,
      'product',
      '400x400',
      'my shoe (1).jpg',
    );
    expect(url).toBe(
      'https://monitor.commerce.services/product/400x400/my%20shoe%20(1).jpg',
    );
  });

  it('returns empty string when baseUrl is empty', () => {
    expect(buildGeinsImageUrl('', 'product', '400x400', 'shoe.jpg')).toBe('');
  });

  it('returns empty string when fileName is empty', () => {
    expect(buildGeinsImageUrl(BASE, 'product', '400x400', '')).toBe('');
  });

  it('works for all image types', () => {
    for (const type of ['product', 'category', 'brand', 'cms'] as const) {
      const url = buildGeinsImageUrl(BASE, type, 'original', 'img.jpg');
      expect(url).toBe(
        `https://monitor.commerce.services/${type}/original/img.jpg`,
      );
    }
  });
});

describe('buildGeinsImageSrcset', () => {
  it('builds product srcset with all sizes', () => {
    const srcset = buildGeinsImageSrcset(BASE, 'product', 'shoe.jpg');
    expect(srcset).toBe(
      [
        'https://monitor.commerce.services/product/100x100/shoe.jpg 100w',
        'https://monitor.commerce.services/product/250x250/shoe.jpg 250w',
        'https://monitor.commerce.services/product/400x400/shoe.jpg 400w',
        'https://monitor.commerce.services/product/800x800/shoe.jpg 800w',
      ].join(', '),
    );
  });

  it('builds category srcset', () => {
    const srcset = buildGeinsImageSrcset(BASE, 'category', 'cat.png');
    expect(srcset).toContain('250w');
    expect(srcset).toContain('500w');
    expect(srcset).toContain('1000w');
  });

  it('builds brand srcset', () => {
    const srcset = buildGeinsImageSrcset(BASE, 'brand', 'logo.png');
    const parts = srcset.split(', ');
    expect(parts).toHaveLength(2);
  });

  it('builds cms srcset', () => {
    const srcset = buildGeinsImageSrcset(BASE, 'cms', 'banner.jpg');
    const parts = srcset.split(', ');
    expect(parts).toHaveLength(3);
  });

  it('returns empty string when baseUrl is empty', () => {
    expect(buildGeinsImageSrcset('', 'product', 'shoe.jpg')).toBe('');
  });

  it('returns empty string when fileName is empty', () => {
    expect(buildGeinsImageSrcset(BASE, 'product', '')).toBe('');
  });

  it('encodes fileName in srcset entries', () => {
    const srcset = buildGeinsImageSrcset(BASE, 'brand', 'my logo.png');
    expect(srcset).toContain('my%20logo.png');
  });
});
