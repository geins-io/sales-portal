/**
 * The alias Geins gives a CMS page from its title when it is published:
 * lowercase, diacritics stripped, every run of other characters one dash.
 *
 * A never-published page has no alias yet, so this is also the URL its draft
 * is previewed on.
 */
export function toCmsPageAlias(title: string | null | undefined): string {
  return (title ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
