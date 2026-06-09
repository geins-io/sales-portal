import { normalizeMenuUrl, isExternalUrl } from '#shared/utils/menu';
import { isSafeInternalPath } from '#shared/utils/redirect';

/**
 * Resolves a CMS page URL by tag and builds a safe internal NuxtLink :to value.
 *
 * Fetches the canonical URL for the given tag from /api/cms/page-link, then
 * routes it through the same normalize pipeline every other CMS link in the
 * app uses: normalizeMenuUrl strips the Geins market/locale prefix and any
 * type indicator, then localePath re-applies the current market/locale prefix.
 *
 * Falls open to localePath(fallback) when:
 *   - the fetch errors
 *   - the resolved URL is null
 *   - the resolved URL is external (isExternalUrl returns true)
 *   - the normalized path fails isSafeInternalPath
 *
 * This guarantees the returned `to` is always a safe in-app path, suitable
 * for NuxtLink :to binding.
 */
export function useCmsPageLink(tag: string, fallback: string) {
  const { localeQuery, localePath } = useLocaleMarket();
  const currentHost = computed(() => useRequestURL().host);

  const { data, error } = useFetch<{ url: string | null }>('/api/cms/page-link', {
    query: computed(() => ({ tag, ...localeQuery.value })),
    dedupe: 'defer',
  });

  const to = computed(() => {
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
    return localePath(fallback);
  });

  return { to };
}
