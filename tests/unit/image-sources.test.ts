import { describe, it, expect } from 'vitest';
import {
  buildCoverSources,
  buildImageSources,
  buildMobileSources,
  buildShareImageUrl,
  COVER_RANGES,
  DESKTOP_MEDIA,
  IMAGE_WIDTHS,
  MOBILE_MEDIA,
  parseAspectRatio,
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

  it('prefers the url over the account host and path', () => {
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

  it.each([null, undefined, '', 'not a url'])(
    'uses the account host and path when the url is %s',
    (url) => {
      const sources = buildImageSources({
        url,
        path: 'content/other.jpg',
        assetBaseUrl: 'https://cdn.example.test/acme',
        type: 'pagewidget',
        imageBaseUrl: LEGACY,
        widths: [80],
      });

      expect(sources.src).toBe(
        'https://cdn.example.test/acme/content/other.jpg?width=80&format=auto',
      );
    },
  );

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

    it('encodes the path as the asset contract does, then adds the size', () => {
      const sources = buildImageSources({
        ...input,
        assetBaseUrl: 'https://cdn.example.test/acme',
        path: 'content/image (1)#2.jpg',
      });

      expect(sources.src).toBe(
        'https://cdn.example.test/acme/content/image%20%281%29%232.jpg?width=80&format=auto',
      );
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

describe('buildImageSources for a box of fixed ratio', () => {
  it('asks the CDN for the box shape, centre-cropped, at every width', () => {
    const sources = buildImageSources({
      url: LIBRARY,
      type: 'product',
      imageBaseUrl: LEGACY,
      widths: [160, 320],
      ratio: 1,
    });

    expect(sources).toEqual({
      src: `${LIBRARY}?width=320&height=320&fit=crop&format=auto`,
      srcset: `${LIBRARY}?width=160&height=160&fit=crop&format=auto 160w, ${LIBRARY}?width=320&height=320&fit=crop&format=auto 320w`,
      origin: 'https://cdn.example.test',
    });
  });

  it('derives each height from the ratio, rounded to the nearest pixel', () => {
    const at = (width: number, ratio: number) =>
      new URL(
        buildImageSources({
          url: LIBRARY,
          type: 'product',
          imageBaseUrl: LEGACY,
          widths: [width],
          ratio,
        }).src,
      ).searchParams.get('height');

    expect(at(1200, 16 / 9)).toBe('675');
    expect(at(160, 1.5)).toBe('107');
    expect(at(80, 0.75)).toBe('107');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined])(
    'asks for width only when the ratio is %s',
    (ratio) => {
      expect(
        buildImageSources({
          url: LIBRARY,
          type: 'product',
          imageBaseUrl: LEGACY,
          widths: [160],
          ratio,
        }).src,
      ).toBe(`${LIBRARY}?width=160&format=auto`);
    },
  );

  it('serves a legacy image exactly as before, whatever the ratio', () => {
    expect(
      buildImageSources({
        url: null,
        fileName: 'shoe.jpg',
        type: 'product',
        imageBaseUrl: LEGACY,
        ratio: 1,
      }),
    ).toEqual({
      src: `${LEGACY}/product/raw/shoe.jpg`,
      srcset: null,
      origin: null,
    });
  });
});

describe('buildCoverSources', () => {
  const cover = (height = 400) =>
    buildCoverSources({
      url: LIBRARY,
      type: 'pagewidget',
      imageBaseUrl: LEGACY,
      height,
    });

  it('gives one source per viewport range, each covering the box at 1x to 3x', () => {
    const { sources } = cover();

    expect(sources.map((s) => s.media)).toEqual([
      '(max-width: 767px)',
      '(min-width: 768px) and (max-width: 1023px)',
      '(min-width: 1024px) and (max-width: 1279px)',
      '(min-width: 1280px)',
    ]);
    expect(sources[0]!.srcset).toBe(
      [
        `${LIBRARY}?width=768&height=400&fit=cover&format=auto 1x`,
        `${LIBRARY}?width=1536&height=800&fit=cover&format=auto 2x`,
        `${LIBRARY}?width=2304&height=1200&fit=cover&format=auto 3x`,
      ].join(', '),
    );
  });

  it('caps the width at the widest request, keeping the height per density', () => {
    const last = cover().sources.at(-1)!;

    expect(last.srcset).toBe(
      [
        `${LIBRARY}?width=1920&height=400&fit=cover&format=auto 1x`,
        `${LIBRARY}?width=3840&height=800&fit=cover&format=auto 2x`,
        `${LIBRARY}?width=3840&height=1200&fit=cover&format=auto 3x`,
      ].join(', '),
    );
  });

  it('gives the img the widest range, so it matches the last source', () => {
    const { src, srcset, origin, sources } = cover(300);

    expect(src).toBe(`${LIBRARY}?width=1920&height=300&fit=cover&format=auto`);
    expect(srcset).toBe(sources.at(-1)!.srcset);
    expect(origin).toBe('https://cdn.example.test');
  });

  it('has ranges that never overlap, so a preload and the picture agree', () => {
    expect(COVER_RANGES.map((r) => r.width)).toEqual([768, 1024, 1280, 1920]);
  });

  it('builds from an account host and path like any library image', () => {
    const { src } = buildCoverSources({
      path: 'content/hero.png',
      assetBaseUrl: 'https://cdn.example.test/acme',
      type: 'pagewidget',
      imageBaseUrl: LEGACY,
      height: 400,
    });

    expect(src).toBe(
      'https://cdn.example.test/acme/content/hero.png?width=1920&height=400&fit=cover&format=auto',
    );
  });

  it('serves a legacy image exactly as before, with no sources', () => {
    expect(
      buildCoverSources({
        fileName: 'hero.png',
        type: 'pagewidget',
        imageBaseUrl: LEGACY,
        height: 400,
      }),
    ).toEqual({
      src: `${LEGACY}/pagewidget/raw/hero.png`,
      srcset: null,
      origin: null,
      sources: [],
    });
  });

  describe('with a mobile image', () => {
    const MOBILE = 'https://cdn.example.test/acme/content/hero-mobile.png';
    const withMobile = (desktop: object, mobile: object) =>
      buildCoverSources({
        type: 'pagewidget',
        imageBaseUrl: LEGACY,
        height: 400,
        ...desktop,
        mobile,
      });

    it('takes the first range only, asked for the same way', () => {
      const plain = cover();
      const { sources, ...img } = withMobile({ url: LIBRARY }, { url: MOBILE });
      const { sources: plainSources, ...plainImg } = plain;

      expect(sources[0]).toEqual({
        media: MOBILE_MEDIA,
        srcset: [
          `${MOBILE}?width=768&height=400&fit=cover&format=auto 1x`,
          `${MOBILE}?width=1536&height=800&fit=cover&format=auto 2x`,
          `${MOBILE}?width=2304&height=1200&fit=cover&format=auto 3x`,
        ].join(', '),
        src: `${MOBILE}?width=768&height=400&fit=cover&format=auto`,
      });
      expect(sources.slice(1)).toEqual(plainSources.slice(1));
      expect(img).toEqual(plainImg);
    });

    it('is the range a mobile image replaces', () => {
      expect(MOBILE_MEDIA).toBe(COVER_RANGES[0]!.media);
      expect(DESKTOP_MEDIA).toBe('(min-width: 768px)');
    });

    it('finds a mobile image by its own path, never the desktop one', () => {
      const { sources } = withMobile(
        { url: LIBRARY, path: 'content/hero.png' },
        { path: 'content/hero-mobile.png', fileName: 'hero-mobile.png' },
      );

      expect(sources[0]!.src).toBe(`${LEGACY}/pagewidget/raw/hero-mobile.png`);
    });

    it('serves a legacy mobile image as its one raw file', () => {
      const { sources } = withMobile(
        { url: LIBRARY },
        { fileName: 'hero-mobile.png', url: null },
      );
      const raw = `${LEGACY}/pagewidget/raw/hero-mobile.png`;

      expect(sources[0]).toEqual({
        media: MOBILE_MEDIA,
        srcset: raw,
        src: raw,
      });
      expect(sources).toHaveLength(COVER_RANGES.length);
    });

    it('gives a legacy image a desktop source, so a phone never fetches it', () => {
      const raw = `${LEGACY}/pagewidget/raw/hero.png`;

      expect(
        withMobile({ fileName: 'hero.png' }, { url: MOBILE }).sources,
      ).toEqual([
        expect.objectContaining({ media: MOBILE_MEDIA }),
        { media: DESKTOP_MEDIA, srcset: raw, src: raw },
      ]);
    });

    it('preconnects to the library a legacy image’s mobile image comes from', () => {
      expect(withMobile({ fileName: 'hero.png' }, { url: MOBILE }).origin).toBe(
        'https://cdn.example.test',
      );
      expect(
        withMobile({ fileName: 'hero.png' }, { fileName: 'hero-mobile.png' })
          .origin,
      ).toBeNull();
    });
  });
});

describe('buildMobileSources', () => {
  const MOBILE = 'https://cdn.example.test/acme/content/banner-mobile.png';
  const SIZES = '(min-width: 1440px) 1280px, 100vw';
  const build = (desktop: object, mobile: object, extra: object = {}) =>
    buildMobileSources({
      type: 'pagewidget',
      imageBaseUrl: LEGACY,
      sizes: SIZES,
      ...desktop,
      mobile,
      ...extra,
    });

  it('shows the mobile image below 768 px and the desktop one above, by width', () => {
    const desktop = buildImageSources({
      url: LIBRARY,
      type: 'pagewidget',
      imageBaseUrl: LEGACY,
    });
    const mobile = buildImageSources({
      url: MOBILE,
      type: 'pagewidget',
      imageBaseUrl: LEGACY,
    });

    expect(build({ url: LIBRARY }, { url: MOBILE })).toEqual({
      ...desktop,
      sources: [
        {
          media: MOBILE_MEDIA,
          srcset: mobile.srcset,
          sizes: SIZES,
          src: mobile.src,
        },
        {
          media: DESKTOP_MEDIA,
          srcset: desktop.srcset,
          sizes: SIZES,
          src: desktop.src,
        },
      ],
    });
  });

  it('keeps the ladder and crop of the image it stands in for', () => {
    const { sources } = build(
      { url: LIBRARY },
      { url: MOBILE },
      { widths: [320, 640], ratio: 2 },
    );

    expect(sources[0]!.srcset).toBe(
      `${MOBILE}?width=320&height=160&fit=crop&format=auto 320w, ${MOBILE}?width=640&height=320&fit=crop&format=auto 640w`,
    );
  });

  it('serves a legacy image on either side as its one raw file, without sizes', () => {
    const { sources, origin } = build(
      { fileName: 'banner.png' },
      { fileName: 'banner-mobile.png' },
    );
    const raw = (name: string) => `${LEGACY}/pagewidget/raw/${name}`;

    expect(sources).toEqual([
      {
        media: MOBILE_MEDIA,
        srcset: raw('banner-mobile.png'),
        src: raw('banner-mobile.png'),
      },
      {
        media: DESKTOP_MEDIA,
        srcset: raw('banner.png'),
        src: raw('banner.png'),
      },
    ]);
    expect(origin).toBeNull();
  });

  it('preconnects to the library a legacy image’s mobile image comes from', () => {
    expect(build({ fileName: 'banner.png' }, { url: MOBILE }).origin).toBe(
      'https://cdn.example.test',
    );
  });
});

describe('parseAspectRatio', () => {
  it.each([
    ['1', 1],
    ['16/9', 16 / 9],
    ['16 / 9', 16 / 9],
    ['1/1', 1],
    ['1.5', 1.5],
    ['21/10', 2.1],
  ])('reads %s as %d', (value, ratio) => {
    expect(parseAspectRatio(value)).toBe(ratio);
  });

  it.each([undefined, '', 'abc', '0', '16/0', '-1', '1/2/3', 'auto'])(
    'has no ratio for %s',
    (value) => {
      expect(parseAspectRatio(value)).toBeUndefined();
    },
  );
});

describe('buildShareImageUrl', () => {
  it('asks the library for 1200 px in the original format, for crawlers', () => {
    expect(
      buildShareImageUrl({
        url: LIBRARY,
        fileName: 'shoe.jpg',
        type: 'product',
        imageBaseUrl: LEGACY,
      }),
    ).toBe(`${LIBRARY}?width=1200`);
  });

  it('keeps a query the url already carries', () => {
    expect(
      buildShareImageUrl({
        url: `${LIBRARY}?v=3`,
        type: 'product',
        imageBaseUrl: LEGACY,
      }),
    ).toBe(`${LIBRARY}?v=3&width=1200`);
  });

  it('gives a legacy image its raw file', () => {
    expect(
      buildShareImageUrl({
        url: null,
        fileName: 'shoe.jpg',
        type: 'product',
        imageBaseUrl: LEGACY,
      }),
    ).toBe(`${LEGACY}/product/raw/shoe.jpg`);
  });

  it('gives nothing without a source', () => {
    expect(buildShareImageUrl({ type: 'product', imageBaseUrl: LEGACY })).toBe(
      '',
    );
  });
});
