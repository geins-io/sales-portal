import { describe, it, expect } from 'vitest';
import {
  buildImageSources,
  IMAGE_WIDTHS,
  PRINT_TILE_WIDTHS,
  THUMBNAIL_WIDTHS,
} from '../../shared/utils/image';

const LEGACY = 'https://acme.commerce.services';
const LIBRARY = 'https://cdn.example.test/acme/products/shoe.jpg';

describe('buildImageSources', () => {
  it('serves a library url at every ladder width in a negotiated format', () => {
    const sources = buildImageSources({
      url: LIBRARY,
      fileName: 'shoe.jpg',
      type: 'product',
      imageBaseUrl: LEGACY,
      widths: [160, 320],
    });

    expect(sources).toEqual({
      src: `${LIBRARY}?width=320&format=auto`,
      srcset: `${LIBRARY}?width=160&format=auto 160w, ${LIBRARY}?width=320&format=auto 320w`,
      origin: 'https://cdn.example.test',
    });
  });

  it('uses the default ladder, with the widest step as src', () => {
    const sources = buildImageSources({
      url: LIBRARY,
      type: 'product',
      imageBaseUrl: LEGACY,
    });

    expect(sources.src).toBe(`${LIBRARY}?width=2560&format=auto`);
    expect(sources.srcset!.split(', ')).toHaveLength(IMAGE_WIDTHS.length);
    expect(sources.srcset!.split(', ')[0]).toBe(
      `${LIBRARY}?width=160&format=auto 160w`,
    );
  });

  it('takes the widest step as src whatever order the ladder is in', () => {
    const sources = buildImageSources({
      url: LIBRARY,
      type: 'product',
      imageBaseUrl: LEGACY,
      widths: [240, 80, 160],
    });

    expect(sources.src).toBe(`${LIBRARY}?width=240&format=auto`);
  });

  it('keeps a query the url already carries', () => {
    const sources = buildImageSources({
      url: `${LIBRARY}?v=3`,
      type: 'product',
      imageBaseUrl: LEGACY,
      widths: [80],
    });

    expect(sources.src).toBe(`${LIBRARY}?v=3&width=80&format=auto`);
  });

  it('has thumbnail and print ladders narrower than the default', () => {
    expect(THUMBNAIL_WIDTHS).toEqual([80, 160, 240]);
    expect(PRINT_TILE_WIDTHS).toEqual([320, 480]);
    expect(IMAGE_WIDTHS).toEqual([
      160, 320, 480, 640, 800, 1200, 1600, 2000, 2560,
    ]);
  });

  it('prefers the url over a path', () => {
    const sources = buildImageSources({
      url: LIBRARY,
      path: 'content/other.jpg',
      assetBaseUrl: 'https://cdn.example.test/acme',
      type: 'pagewidget',
      imageBaseUrl: LEGACY,
      widths: [80],
    });

    expect(sources.src).toBe(`${LIBRARY}?width=80&format=auto`);
  });

  describe('a library path joined to the account base', () => {
    const input = {
      type: 'pagewidget' as const,
      imageBaseUrl: LEGACY,
      fileName: 'banner4.jpg',
      widths: [80],
    };

    it.each([
      ['https://cdn.example.test/acme', 'content/banner4.jpg'],
      ['https://cdn.example.test/acme/', 'content/banner4.jpg'],
      ['https://cdn.example.test/acme', '/content/banner4.jpg'],
      ['https://cdn.example.test/acme//', '//content/banner4.jpg'],
    ])('joins %s and %s with exactly one slash', (assetBaseUrl, path) => {
      const sources = buildImageSources({ ...input, assetBaseUrl, path });

      expect(sources).toEqual({
        src: 'https://cdn.example.test/acme/content/banner4.jpg?width=80&format=auto',
        srcset:
          'https://cdn.example.test/acme/content/banner4.jpg?width=80&format=auto 80w',
        origin: 'https://cdn.example.test',
      });
    });

    it('keeps the path as given, case included', () => {
      const sources = buildImageSources({
        ...input,
        assetBaseUrl: 'https://cdn.example.test/acme',
        path: 'content/Banner4.jpg',
      });

      expect(sources.src).toBe(
        'https://cdn.example.test/acme/content/Banner4.jpg?width=80&format=auto',
      );
    });

    it('falls back to the legacy file without an account base', () => {
      const sources = buildImageSources({
        ...input,
        assetBaseUrl: '',
        path: 'content/banner4.jpg',
      });

      expect(sources).toEqual({
        src: `${LEGACY}/pagewidget/raw/banner4.jpg`,
        srcset: null,
        origin: null,
      });
    });

    it('falls back to the legacy file without a path', () => {
      const sources = buildImageSources({
        ...input,
        assetBaseUrl: 'https://cdn.example.test/acme',
        path: null,
      });

      expect(sources.src).toBe(`${LEGACY}/pagewidget/raw/banner4.jpg`);
    });
  });

  it('serves a legacy image byte-for-byte as before: raw, one source', () => {
    expect(
      buildImageSources({
        url: null,
        fileName: 'shoe.jpg',
        type: 'product',
        imageBaseUrl: LEGACY,
      }),
    ).toEqual({
      src: `${LEGACY}/product/raw/shoe.jpg`,
      srcset: null,
      origin: null,
    });
  });

  it('treats a url that is not absolute as no library url', () => {
    expect(
      buildImageSources({
        url: '/i/shoe.jpg',
        fileName: 'shoe.jpg',
        type: 'product',
        imageBaseUrl: LEGACY,
      }),
    ).toEqual({
      src: `${LEGACY}/product/raw/shoe.jpg`,
      srcset: null,
      origin: null,
    });
  });

  it.each(['data:image/png;base64,AAAA', 'javascript:alert(1)'])(
    'treats a %s url as no library url',
    (url) => {
      expect(
        buildImageSources({
          url,
          fileName: 'shoe.jpg',
          type: 'product',
          imageBaseUrl: LEGACY,
        }).src,
      ).toBe(`${LEGACY}/product/raw/shoe.jpg`);
    },
  );

  it('accepts a plain http library url', () => {
    expect(
      buildImageSources({
        url: 'http://cdn.example.test/acme/products/shoe.jpg',
        type: 'product',
        imageBaseUrl: LEGACY,
        widths: [80],
      }).origin,
    ).toBe('http://cdn.example.test');
  });

  it('gives nothing to render without any source', () => {
    expect(
      buildImageSources({ type: 'product', imageBaseUrl: LEGACY }),
    ).toEqual({ src: '', srcset: null, origin: null });
    expect(
      buildImageSources({
        fileName: 'shoe.jpg',
        type: 'product',
        imageBaseUrl: '',
      }),
    ).toEqual({ src: '', srcset: null, origin: null });
  });
});
