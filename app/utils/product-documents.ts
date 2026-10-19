import type { ProductAsset } from '#shared/types/commerce';

/** A row of the Documents tab. */
export interface ProductDocument {
  id: string;
  /** The description in the page language, else the file name. */
  name: string;
  /** What the file is saved as. */
  fileName: string;
  /** Lower-case extension: "pdf", "docx", "zip"; empty when there is none. */
  fileType: string;
  sizeBytes: number;
  url: string;
}

/** File types the browser shows itself; these get "View" and open in a new tab. */
const VIEWABLE_TYPES = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
const AUDIO_TYPES = ['mp3', 'wav', 'm4a', 'ogg'];

function extension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/**
 * The product's files, in the order the API sends them. The API's own
 * `mediaType` cannot tell a Word file from a spreadsheet, so the type is read
 * off the extension. A description in another language is never shown: the
 * account's default language is missing from the list, and a Danish text on a
 * Swedish page is worse than the file name.
 */
export function productDocuments(
  assets: ProductAsset[] | null | undefined,
  language: string,
): ProductDocument[] {
  return (assets ?? [])
    .filter((asset) => asset.linkType === 'productfile')
    .map((asset) => {
      const description = asset.description
        ?.find((d) => d.language === language)
        ?.value.trim();
      return {
        id: asset.id,
        name: description || asset.name,
        fileName: asset.name,
        fileType: extension(asset.name),
        sizeBytes: asset.sizeBytes,
        url: asset.url,
      };
    });
}

/** Only same-origin paths and https URLs become links. */
export function safeDocumentUrl(url: string): string | null {
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('https://')) return url;
  return null;
}

/**
 * The file's url with `download=1`, which the Geins CDN answers with
 * `content-disposition: attachment` under the file's own name.
 */
export function documentDownloadUrl(url: string): string {
  const hash = url.indexOf('#');
  const base = hash === -1 ? url : url.slice(0, hash);
  const fragment = hash === -1 ? '' : url.slice(hash);
  return `${base}${base.includes('?') ? '&' : '?'}download=1${fragment}`;
}

export function isViewableDocument(fileType: string): boolean {
  return VIEWABLE_TYPES.includes(fileType);
}

export function documentIconKind(fileType: string): 'image' | 'audio' | 'text' {
  if (IMAGE_TYPES.includes(fileType)) return 'image';
  if (AUDIO_TYPES.includes(fileType)) return 'audio';
  return 'text';
}

/** "38 kB" below a megabyte, "2,3 MB" from one, in the page locale. */
export function formatDocumentSize(bytes: number, locale: string): string {
  const format = (n: number, digits: number) =>
    n.toLocaleString(locale, { maximumFractionDigits: digits });
  if (bytes < 1_000_000) {
    return `${format(Math.max(1, Math.round(bytes / 1000)), 0)} kB`;
  }
  return `${format(bytes / 1_000_000, 1)} MB`;
}
