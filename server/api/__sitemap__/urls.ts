import type { TenantConfig } from '#shared/types/tenant-config';
import { getTenantSDK, getChannelVariables } from '../../services/_sdk';
import { loadQuery } from '../../services/graphql/loader';
import { unwrapGraphQL } from '../../services/graphql/unwrap';

interface SitemapEntry {
  loc: string;
  changefreq: string;
  priority: number;
}

interface CategoryNode {
  alias?: string;
}

interface BrandNode {
  alias?: string;
}

/**
 * Dynamic sitemap source for @nuxtjs/sitemap.
 *
 * Returns an array of sitemap entries with locale/market-prefixed URLs.
 * Reads available markets and locales from tenant config so each
 * market/locale combination gets its own entry.
 *
 * Fetches categories and brands from the Geins API for each locale/market
 * combination. Products are discovered via category pages -- individual
 * product URLs are not included here.
 */
export default defineEventHandler(async (event) => {
  const config = (event.context.tenant as { config?: TenantConfig } | undefined)
    ?.config;

  const geinsSettings = config?.geinsSettings;
  const markets = geinsSettings?.availableMarkets ?? ['se'];
  const availableLocales = geinsSettings?.availableLocales ?? ['en'];
  const locales = availableLocales.map((l) => l.split('-')[0]!);

  const entries: SitemapEntry[] = [];

  // Generate root entries for each market/locale combination
  for (const market of markets) {
    for (const locale of locales) {
      entries.push({
        loc: `/${market}/${locale}/`,
        changefreq: 'daily',
        priority: 1.0,
      });
    }
  }

  // Fetch categories and brands from the Geins API
  try {
    const sdk = await getTenantSDK(event);

    for (const market of markets) {
      for (let i = 0; i < locales.length; i++) {
        const locale = locales[i]!;
        const bcp47Locale = availableLocales[i]!;

        const channelVars = getChannelVariables(
          sdk,
          bcp47Locale,
          market,
          availableLocales,
        );

        const [categoriesRaw, brandsRaw] = await Promise.all([
          wrapServiceCall(
            () =>
              sdk.core.graphql.query({
                queryAsString: loadQuery('categories/categories.graphql'),
                variables: channelVars,
              }),
            'categories',
          ).then(unwrapGraphQL),
          wrapServiceCall(
            () =>
              sdk.core.graphql.query({
                queryAsString: loadQuery('brands/brands.graphql'),
                variables: channelVars,
              }),
            'brands',
          ).then(unwrapGraphQL),
        ]);

        const categories = Array.isArray(categoriesRaw)
          ? (categoriesRaw as CategoryNode[])
          : [];
        const brands = Array.isArray(brandsRaw)
          ? (brandsRaw as BrandNode[])
          : [];

        for (const category of categories) {
          if (category.alias) {
            entries.push({
              loc: `/${market}/${locale}/c/${category.alias}`,
              changefreq: 'weekly',
              priority: 0.8,
            });
          }
        }

        for (const brand of brands) {
          if (brand.alias) {
            entries.push({
              loc: `/${market}/${locale}/b/${brand.alias}`,
              changefreq: 'weekly',
              priority: 0.6,
            });
          }
        }
      }
    }
  } catch {
    // If the API is unreachable, return root entries only.
    // The sitemap will be regenerated on the next request.
  }

  // TODO: Add individual product URLs when a lightweight product listing
  // endpoint is available. Products are currently discovered via category
  // pages, but having direct product URLs in the sitemap would improve
  // crawl coverage for search engines.

  return entries;
});
