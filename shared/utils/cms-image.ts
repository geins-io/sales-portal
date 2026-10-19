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
