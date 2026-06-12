import { normalizeMenuUrl, isExternalUrl } from '#shared/utils/menu';
import { isSafeInternalPath } from '#shared/utils/redirect';

/**
 * Resolves a CMS page URL by tag and builds a safe internal NuxtLink :to value.
 *
 * Fetches the URL for the given tag from /api/cms/page-link, then routes it
 * through the same normalize pipeline every other CMS link in the app uses:
 * normalizeMenuUrl strips the Geins market/locale prefix and any type indicator,
 * then localePath re-applies the current market/locale prefix.
 *
 * Returns { to, isResolved }:
 *   - to is a safe in-app localePath when the CMS page is resolvable and internal.
 *   - to is null and isResolved is false when the fetch errors, the resolved URL
 *     is null, the URL is external, or the normalized path fails isSafeInternalPath.
 *
 * Consumers must gate rendering on isResolved so unresolved links are hidden
 * rather than rendered as hrefless anchors.
 */
export function useCmsPageLink(tag: string) {
  const { localeQuery, localePath } = useLocaleMarket();
  const currentHost = computed(() => useRequestURL().host);

  const { data, error } = useFetch<{ url: string | null }>(
    '/api/cms/page-link',
    {
      query: computed(() => ({ tag, ...localeQuery.value })),
      dedupe: 'defer',
    },
  );

  const to = computed<string | undefined>(() => {
    const resolved = data.value?.url;
    if (
      !error.value &&
      resolved &&
      !isExternalUrl(resolved, currentHost.value)
    ) {
      // Strip the Geins market/locale prefix (and any type indicator) the same
      // way LayoutHeaderNav does, then let localePath re-apply the current prefix.
      // Example: /se/sv/kontakt -> /kontakt -> localePath -> /<market>/<locale>/kontakt
      const path = normalizeMenuUrl(resolved, currentHost.value);
      if (isSafeInternalPath(path)) return localePath(path);
    }
    return undefined;
  });

  const isResolved = computed(() => to.value !== undefined);

  return { to, isResolved };
}
