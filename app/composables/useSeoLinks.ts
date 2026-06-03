/**
 * Composable for generating canonical + hreflang link tags.
 *
 * Produces a canonical link for the current locale/market and alternate
 * hreflang links for every valid locale, plus an x-default entry.
 * Calls `useHead({ link })` internally so consumers only need to call
 * `useSeoLinks(path)`.
 *
 * @param path - Reactive or static page path WITHOUT locale/market prefix
 *               (e.g., `/p/my-product`, `/c/my-category`, `/`).
 * @param localeOverrides - Optional map of short locale code to full app path
 *   (e.g. `{ en: '/se/en/p/real-english-slug' }`). When present, the matching
 *   locale's alternate href uses the override instead of the naive prefix-swap.
 *   Accepts a plain object, a ref, or a getter (MaybeRefOrGetter). Existing
 *   single-arg callers are unaffected (backward compatible).
 *
 *   Feed this from `useLocaleAlternates().alternates` on PDP/PLP so hreflang
 *   points at the REAL localized slug rather than a naive same-slug swap that
 *   may 404 in the other locale. Never derived from window or client-only
 *   state: must compute identically on SSR and client to avoid hydration mismatches.
 */
export function useSeoLinks(
  path: MaybeRefOrGetter<string>,
  localeOverrides?: MaybeRefOrGetter<Record<string, string>>,
) {
  const { currentMarket, currentLocale, validLocales } = useLocaleMarket();

  const seoLinks = computed(() => {
    const m = currentMarket.value;
    const l = currentLocale.value;
    const pagePath = toValue(path);
    const overrides = toValue(localeOverrides) ?? {};

    const links: Array<{ rel: string; href: string; hreflang?: string }> = [];

    // Canonical: always uses the current locale with the naive path (no override).
    const canonicalHref =
      pagePath === '/' ? `/${m}/${l}/` : `/${m}/${l}${pagePath}`;
    links.push({ rel: 'canonical', href: canonicalHref });

    // Hreflang alternates for each valid locale.
    // When a per-locale override exists, use it (it already carries the full
    // /{market}/{locale}/{type}/... path). Otherwise fall back to the naive
    // prefix-swap so single-arg callers and locales without an override are
    // unaffected.
    const localeArray = Array.from(validLocales.value).filter(
      (loc): loc is string => typeof loc === 'string',
    );

    for (const loc of localeArray) {
      const hreflang = `${loc}-${m.toUpperCase()}`;
      const href =
        overrides[loc] ??
        (pagePath === '/' ? `/${m}/${loc}/` : `/${m}/${loc}${pagePath}`);
      links.push({ rel: 'alternate', href, hreflang });
    }

    // x-default: prefer 'en' if available, otherwise first locale.
    // Uses the override for the default locale when present.
    const defaultLocale = validLocales.value.has('en')
      ? 'en'
      : (localeArray[0] ?? l);
    const xDefaultHref =
      overrides[defaultLocale] ??
      (pagePath === '/'
        ? `/${m}/${defaultLocale}/`
        : `/${m}/${defaultLocale}${pagePath}`);
    links.push({ rel: 'alternate', href: xDefaultHref, hreflang: 'x-default' });

    return links;
  });

  useHead({ link: seoLinks });

  return { seoLinks };
}
