import { hreflangFor } from '~/utils/locale-bcp47';
import { toAbsoluteUrl } from '~/utils/absolute-url';

/**
 * Composable for generating canonical + hreflang link tags, as absolute URLs
 * on the tenant site URL (og:url follows the canonical).
 *
 * Produces a canonical link for the current locale/market and alternate
 * hreflang links for every valid locale, plus an x-default entry.
 * `hreflangFor` owns the alternate hreflang rule.
 *
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
  const { tenant } = useTenant();
  const siteConfig = useSiteConfig();

  const seoLinks = computed(() => {
    const m = currentMarket.value;
    const l = currentLocale.value;
    const pagePath = toValue(path);
    const overrides = toValue(localeOverrides) ?? {};
    const abs = (href: string) => toAbsoluteUrl(href, siteConfig.url);

    const fullLocales = tenant.value?.availableLocales;

    const links: Array<
      | { rel: 'canonical'; href: string; hreflang?: undefined }
      | { rel: 'alternate'; href: string; hreflang: string }
    > = [];

    // Canonical: always uses the current locale with the naive path (no override).
    const canonicalHref =
      pagePath === '/' ? `/${m}/${l}/` : `/${m}/${l}${pagePath}`;
    links.push({ rel: 'canonical', href: abs(canonicalHref) });

    // Hreflang alternates for each valid locale.
    // When a per-locale override exists, use it (it already carries the full
    // /{market}/{locale}/{type}/... path). Otherwise fall back to the naive
    // prefix-swap so single-arg callers and locales without an override are
    // unaffected.
    const localeArray = Array.from(validLocales.value).filter(
      (loc): loc is string => typeof loc === 'string',
    );

    for (const loc of localeArray) {
      const hreflang = hreflangFor(loc, m, fullLocales);
      const href =
        overrides[loc] ??
        (pagePath === '/' ? `/${m}/${loc}/` : `/${m}/${loc}${pagePath}`);
      links.push({ rel: 'alternate', href: abs(href), hreflang });
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
    links.push({
      rel: 'alternate',
      href: abs(xDefaultHref),
      hreflang: 'x-default',
    });

    return links;
  });

  useHead({ link: seoLinks });

  return { seoLinks };
}
