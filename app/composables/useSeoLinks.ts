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
 */
export function useSeoLinks(path: MaybeRefOrGetter<string>) {
  const { currentMarket, currentLocale, validLocales } = useLocaleMarket();

  const seoLinks = computed(() => {
    const m = currentMarket.value;
    const l = currentLocale.value;
    const pagePath = toValue(path);

    const links: Array<{ rel: string; href: string; hreflang?: string }> = [];

    // Canonical
    const canonicalHref =
      pagePath === '/' ? `/${m}/${l}/` : `/${m}/${l}${pagePath}`;
    links.push({ rel: 'canonical', href: canonicalHref });

    // Hreflang alternates for each valid locale
    const localeArray = Array.from(validLocales.value).filter(
      (loc): loc is string => typeof loc === 'string',
    );

    for (const loc of localeArray) {
      const hreflang = `${loc}-${m.toUpperCase()}`;
      const href =
        pagePath === '/' ? `/${m}/${loc}/` : `/${m}/${loc}${pagePath}`;
      links.push({ rel: 'alternate', href, hreflang });
    }

    // x-default: prefer 'en' if available, otherwise first locale
    const defaultLocale = validLocales.value.has('en')
      ? 'en'
      : (localeArray[0] ?? l);
    const xDefaultHref =
      pagePath === '/'
        ? `/${m}/${defaultLocale}/`
        : `/${m}/${defaultLocale}${pagePath}`;
    links.push({ rel: 'alternate', href: xDefaultHref, hreflang: 'x-default' });

    return links;
  });

  useHead({ link: seoLinks });

  return { seoLinks };
}
