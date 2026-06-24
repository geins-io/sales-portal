import type { ContentContainerType } from '@geins/types';
import type {
  CmsContainerVisibility,
  CmsContentContainer,
} from '#shared/types/cms';

/**
 * Maps a CMS container's derived viewport visibility to a Tailwind class so the
 * "Display settings" admin option is honoured purely by the breakpoint, i.e.
 * resize-aware rather than User-Agent based.
 *
 *   'mobile'  -> shown below `md`, hidden from `md` up   (md:hidden)
 *   'desktop' -> hidden below `md`, shown from `md` up    (hidden md:block)
 *   'always' / undefined / unknown -> always visible      ('')
 *
 * Unknown values stay visible so an unexpected tag can never blank a container.
 */
export function cmsVisibilityClass(
  visibility: CmsContainerVisibility | string | null | undefined,
): string {
  switch ((visibility ?? '').trim().toLowerCase()) {
    case 'mobile':
      return 'md:hidden';
    case 'desktop':
      return 'hidden md:block';
    default:
      return '';
  }
}

/**
 * Merges the two display-setting fetches into one container list, tagging each
 * container with the viewport visibility it should have.
 *
 * Geins never returns mobile-only and desktop-only containers in the same
 * response: the `displaySetting` query filter pre-selects them server-side. A
 * desktop leg returns "always + desktop-only" containers and a mobile leg
 * returns "always + mobile-only". We tag each container by which legs returned
 * it:
 *   - in both legs    -> 'always'  (shown everywhere)
 *   - desktop leg only -> 'desktop' (hidden below `md`)
 *   - mobile leg only  -> 'mobile'  (hidden from `md` up)
 *
 * Containers are de-duplicated by id and ordered by sortOrder so the merged
 * list matches the single-fetch ordering.
 */
export function mergeContainersByVisibility(
  desktopContainers: ContentContainerType[],
  mobileContainers: ContentContainerType[],
): CmsContentContainer[] {
  const desktopIds = new Set(desktopContainers.map((c) => c.id));
  const mobileIds = new Set(mobileContainers.map((c) => c.id));

  const byId = new Map<string, CmsContentContainer>();

  for (const container of desktopContainers) {
    byId.set(container.id, {
      ...container,
      visibility: mobileIds.has(container.id) ? 'always' : 'desktop',
    });
  }

  for (const container of mobileContainers) {
    // Already tagged 'always' from the desktop leg — keep that tag.
    if (byId.has(container.id)) continue;
    byId.set(container.id, {
      ...container,
      visibility: desktopIds.has(container.id) ? 'always' : 'mobile',
    });
  }

  return [...byId.values()].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}
