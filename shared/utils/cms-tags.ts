/**
 * Geins CMS pages carry a `tags: string[]` field that editors set in the
 * admin (e.g. `["#menu", "#promo"]`). Tags come back hashtag-prefixed and
 * with whatever casing the editor typed.
 *
 * `hasPageTag` is the only sanctioned way to check tag presence: it
 * strips the optional leading `#` and lower-cases both sides so a
 * registry constant like `CMS_TAGS.SIDEBAR_MENU = 'menu'` matches the
 * stored `'#menu'`, `'menu'`, `'Menu'`, or `' #MENU '` equally.
 */
export interface PageWithTags {
  tags?: string[] | null;
}

export function hasPageTag(
  page: PageWithTags | null | undefined,
  tag: string,
): boolean {
  if (!page?.tags?.length) return false;
  const target = normalizeTag(tag);
  if (!target) return false;
  return page.tags.some((t) => normalizeTag(t) === target);
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').toLowerCase();
}
