import { buildGeinsRawUrl } from '@geins/core';
import type { GeinsImageType } from '@geins/core';
import { composeAssetUrl } from './cms-image';

// Re-export image URL builders from the SDK.
export {
  buildGeinsImageUrl,
  buildGeinsRawUrl,
  buildGeinsThumbnailUrl,
} from '@geins/core';

/** Widths the asset library is asked for; the browser picks one per `sizes`. */
export const IMAGE_WIDTHS = [160, 320, 480, 640, 800, 1200, 1600, 2000, 2560];

/** Ladder for images rendered at 40–64 css px, up to 3x density. */
export const THUMBNAIL_WIDTHS = [80, 160, 240];

/** Ladder for the print-only image tiles, about 240 px wide on paper. */
export const PRINT_TILE_WIDTHS = [320, 480];

/**
 * Viewport ranges for a box of fixed height and fluid width, each asked for
 * at its widest viewport. The queries never overlap, so a preload resolves to
 * the same file as the `<picture>`.
 */
export const COVER_RANGES = [
  { media: '(max-width: 767px)', width: 768 },
  { media: '(min-width: 768px) and (max-width: 1023px)', width: 1024 },
  { media: '(min-width: 1024px) and (max-width: 1279px)', width: 1280 },
  { media: '(min-width: 1280px)', width: 1920 },
];

/**
 * Viewports that get a separate mobile image, and the rest. The mobile query
 * is the first cover range, so a mobile image takes exactly that range's place.
 */
export const MOBILE_MEDIA = COVER_RANGES[0]!.media;
export const DESKTOP_MEDIA = '(min-width: 768px)';

const COVER_DENSITIES = [1, 2, 3];
const MAX_COVER_WIDTH = 3840;

export interface ImageSources {
  src: string;
  /** Width candidates; null for a legacy image, which has one size only. */
  srcset: string | null;
  /** The library's origin, for a preconnect; null for a legacy image. */
  origin: string | null;
}

export interface PictureSource {
  media: string;
  srcset: string;
  /** Set when the candidates are widths. */
  sizes?: string;
  /** The URL a preload falls back to; the img's `src` when absent. */
  src?: string;
}

export interface CoverSources extends ImageSources {
  /**
   * One `<source>` per viewport range; empty for a legacy image without a
   * mobile image.
   */
  sources: PictureSource[];
}

/** Where one image lives: its library `url`, library `path`, or legacy file. */
export interface ImageRef {
  url?: string | null;
  path?: string | null;
  fileName?: string | null;
}

interface SourceInput extends ImageRef {
  assetBaseUrl?: string;
  type: GeinsImageType;
  imageBaseUrl: string;
}

/**
 * One image's sources, in this order: the asset library `url` the API
 * returns; else the library `path` from CMS configuration joined to the
 * account's `assetBaseUrl`, the only route for JSON widgets, which have no
 * `url`; else the legacy raw file on `imageBaseUrl`. The `url` goes first
 * because a saved `path` can go stale after a move or rename while the `url`
 * still works.
 * A library image is resized by its CDN (`width`) and served as AVIF or WebP
 * where the browser accepts it (`format=auto`). With the `ratio` of a box that
 * crops, each width also gets that box's height and `fit=crop`, the CDN's
 * centre crop; without `fit` the CDN would stretch the image to both sizes.
 */
export function buildImageSources(
  input: SourceInput & { widths?: number[]; ratio?: number },
): ImageSources {
  const library = libraryUrl(input);
  if (!library) return legacySources(input);

  const widths = input.widths ?? IMAGE_WIDTHS;
  const ratio = input.ratio ?? 0;
  const crops = Number.isFinite(ratio) && ratio > 0;
  const at = (width: number) =>
    sized(
      library,
      width,
      crops ? { height: Math.round(width / ratio), fit: 'crop' } : undefined,
    );
  return {
    src: at(Math.max(...widths)),
    srcset: widths.map((width) => `${at(width)} ${width}w`).join(', '),
    origin: library.origin,
  };
}

/**
 * Sources for a box of fixed `height` (css px) and fluid width, whose ratio
 * follows the viewport: per range in `COVER_RANGES`, 1x to 3x of the range's
 * widest box. `fit=cover` returns the whole image scaled to cover both sizes,
 * and the img's `object-cover` crops it as before. The img takes the widest
 * range; a legacy image has no sources.
 *
 * A `mobile` image replaces the first range, asked for the same way, or as
 * its one raw file when legacy. A legacy image with a mobile image gets a
 * desktop source too, so a preload never fetches it on a phone.
 */
export function buildCoverSources(
  input: SourceInput & { height: number; mobile?: ImageRef },
): CoverSources {
  const mobileLibrary =
    input.mobile && libraryUrl({ ...input, ...refOf(input.mobile) });
  const mobile = input.mobile && mobileCoverSource(input, input.mobile);
  const library = libraryUrl(input);
  if (!library) {
    const legacy = legacySources(input);
    return {
      ...legacy,
      origin: legacy.origin ?? mobileLibrary?.origin ?? null,
      sources: mobile
        ? [
            mobile,
            { media: DESKTOP_MEDIA, srcset: legacy.src, src: legacy.src },
          ]
        : [],
    };
  }

  const sources: PictureSource[] = COVER_RANGES.map(({ media, width }) => ({
    media,
    srcset: coverSrcset(library, width, input.height),
  }));
  if (mobile) sources[0] = mobile;
  const widest = COVER_RANGES.at(-1)!.width;
  return {
    src: coverUrl(library, widest, input.height, 1),
    srcset: sources.at(-1)!.srcset,
    origin: library.origin,
    sources,
  };
}

/**
 * Sources for an image whose box is sized by width (see `buildImageSources`)
 * with a separate `mobile` image: a mobile source below `MOBILE_MEDIA`, then
 * the desktop candidates above it, each with `sizes` when they are widths.
 * The img keeps the desktop candidates for browsers without `<picture>`.
 */
export function buildMobileSources(
  input: SourceInput & {
    mobile: ImageRef;
    sizes: string;
    widths?: number[];
    ratio?: number;
  },
): CoverSources {
  const desktop = buildImageSources(input);
  const mobile = buildImageSources({ ...input, ...refOf(input.mobile) });
  return {
    ...desktop,
    origin: desktop.origin ?? mobile.origin,
    sources: [
      pictureSource(MOBILE_MEDIA, mobile, input.sizes),
      pictureSource(DESKTOP_MEDIA, desktop, input.sizes),
    ],
  };
}

/**
 * A box's width-to-height ratio from an `aspect-ratio` value such as `1`,
 * `16/9` or `16 / 9`; undefined when it is not a positive ratio.
 */
export function parseAspectRatio(
  value: string | undefined,
): number | undefined {
  const match = value?.match(/^\s*([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?$/);
  if (!match) return undefined;
  const ratio = Number(match[1]) / Number(match[2] ?? 1);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}

function libraryUrl(input: SourceInput): URL | undefined {
  return (
    absoluteUrl(input.url) ??
    absoluteUrl(composeAssetUrl(input.assetBaseUrl, input.path))
  );
}

function legacySources(input: SourceInput): ImageSources {
  return {
    src: buildGeinsRawUrl(input.imageBaseUrl, input.type, input.fileName ?? ''),
    srcset: null,
    origin: null,
  };
}

/** Only the image's own fields, so none of the desktop image's leak in. */
function refOf(ref: ImageRef): ImageRef {
  return { url: ref.url, path: ref.path, fileName: ref.fileName };
}

function mobileCoverSource(
  input: SourceInput & { height: number },
  mobile: ImageRef,
): PictureSource {
  const ref = { ...input, ...refOf(mobile) };
  const library = libraryUrl(ref);
  if (!library) {
    const { src } = legacySources(ref);
    return { media: MOBILE_MEDIA, srcset: src, src };
  }
  const width = COVER_RANGES[0]!.width;
  return {
    media: MOBILE_MEDIA,
    srcset: coverSrcset(library, width, input.height),
    src: coverUrl(library, width, input.height, 1),
  };
}

function pictureSource(
  media: string,
  { src, srcset }: ImageSources,
  sizes: string,
): PictureSource {
  return srcset ? { media, srcset, sizes, src } : { media, srcset: src, src };
}

function coverSrcset(library: URL, width: number, height: number): string {
  return COVER_DENSITIES.map(
    (d) => `${coverUrl(library, width, height, d)} ${d}x`,
  ).join(', ');
}

function coverUrl(
  library: URL,
  width: number,
  height: number,
  density: number,
): string {
  return sized(library, Math.min(width * density, MAX_COVER_WIDTH), {
    height: height * density,
    fit: 'cover',
  });
}

function sized(
  library: URL,
  width: number,
  box?: { height: number; fit: 'crop' | 'cover' },
): string {
  const url = new URL(library);
  url.searchParams.set('width', String(width));
  if (box) {
    url.searchParams.set('height', String(box.height));
    url.searchParams.set('fit', box.fit);
  }
  url.searchParams.set('format', 'auto');
  return url.toString();
}

/**
 * An image URL for crawlers (og:image, Schema.org): the library image at
 * 1200 px in its original format, since crawlers want JPEG or PNG, not AVIF;
 * else the legacy raw file.
 */
export function buildShareImageUrl(input: {
  url?: string | null;
  fileName?: string | null;
  type: GeinsImageType;
  imageBaseUrl: string;
}): string {
  const library = absoluteUrl(input.url);
  if (library) {
    library.searchParams.set('width', '1200');
    return library.toString();
  }
  return buildGeinsRawUrl(input.imageBaseUrl, input.type, input.fileName ?? '');
}

function absoluteUrl(value: string | null | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}
