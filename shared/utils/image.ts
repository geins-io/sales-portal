import { GEINS_IMAGE_SIZES, type GeinsImageType } from '../constants/image';

/**
 * Builds a single Geins CDN image URL.
 *
 * Pattern: https://{accountName}.commerce.services/{type}/{folder}/{encodedFileName}
 */
export function buildGeinsImageUrl(
  baseUrl: string,
  type: GeinsImageType,
  folder: string,
  fileName: string,
): string {
  if (!baseUrl || !fileName) return '';
  return `${baseUrl}/${type}/${folder}/${encodeURIComponent(fileName)}`;
}

/**
 * Builds a full srcset string from the GEINS_IMAGE_SIZES registry.
 *
 * Example output:
 *   ".../product/100x100/img.jpg 100w, .../product/250x250/img.jpg 250w, ..."
 */
export function buildGeinsImageSrcset(
  baseUrl: string,
  type: GeinsImageType,
  fileName: string,
): string {
  if (!baseUrl || !fileName) return '';
  const sizes = GEINS_IMAGE_SIZES[type];
  if (!sizes?.length) return '';
  return sizes
    .map(
      (s) =>
        `${buildGeinsImageUrl(baseUrl, type, s.folder, fileName)} ${s.width}w`,
    )
    .join(', ');
}
