import type { ContentImageType } from '@geins/types';

/**
 * The asset library URL of a widget's configured image: the entry in the
 * widget's `images` whose `fileName` is the configuration's file name. Null
 * when no entry matches or the match is outside the library.
 */
export function widgetImageUrl(
  images:
    | readonly Pick<ContentImageType, 'fileName' | 'url'>[]
    | null
    | undefined,
  fileName: string,
): string | null {
  if (!fileName) return null;
  return images?.find((image) => image.fileName === fileName)?.url ?? null;
}

/**
 * An asset library URL from the account's asset host and a library path, as
 * the API builds `images[].url`: each path segment percent-encoded so only
 * `A-Z a-z 0-9 - . _ ~` stay as they are. Null without a host or a path.
 */
export function composeAssetUrl(
  host: string | null | undefined,
  path: string | null | undefined,
): string | null {
  const base = host?.replace(/\/+$/, '');
  const relative = path?.replace(/^\/+/, '');
  if (!base || !relative) return null;
  return `${base}/${relative.split('/').map(encodeSegment).join('/')}`;
}

function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
