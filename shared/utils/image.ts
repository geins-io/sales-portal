import { buildGeinsRawUrl } from '@geins/core';
import type { GeinsImageType } from '@geins/core';

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

export interface ImageSources {
  src: string;
  /** Width candidates; null for a legacy image, which has one size only. */
  srcset: string | null;
  /** The library's origin, for a preconnect; null for a legacy image. */
  origin: string | null;
}

/**
 * One image's sources, in this order: the asset library `url` the API
 * returns; else the library `path` from CMS configuration joined to the
 * account's `assetBaseUrl`; else the legacy raw file on `imageBaseUrl`.
 * A library image is resized by its CDN (`width`) and served as AVIF or WebP
 * where the browser accepts it (`format=auto`).
 */
export function buildImageSources(input: {
  url?: string | null;
  path?: string | null;
  assetBaseUrl?: string;
  fileName?: string | null;
  type: GeinsImageType;
  imageBaseUrl: string;
  widths?: number[];
}): ImageSources {
  const library =
    absoluteUrl(input.url) ??
    (input.assetBaseUrl && input.path
      ? absoluteUrl(
          `${input.assetBaseUrl.replace(/\/+$/, '')}/${input.path.replace(/^\/+/, '')}`,
        )
      : undefined);

  if (library) {
    const widths = input.widths ?? IMAGE_WIDTHS;
    const at = (width: number) => {
      const sized = new URL(library);
      sized.searchParams.set('width', String(width));
      sized.searchParams.set('format', 'auto');
      return sized.toString();
    };
    return {
      src: at(Math.max(...widths)),
      srcset: widths.map((width) => `${at(width)} ${width}w`).join(', '),
      origin: library.origin,
    };
  }

  return {
    src: buildGeinsRawUrl(input.imageBaseUrl, input.type, input.fileName ?? ''),
    srcset: null,
    origin: null,
  };
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
