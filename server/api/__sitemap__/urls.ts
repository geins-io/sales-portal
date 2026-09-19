import type { TenantConfig } from '#shared/types/tenant-config';
import type { CategoryNode } from '#shared/utils/breadcrumb-trail';
import { categoryPath } from '#shared/utils/route-helpers';
import { getTenantSDK, getChannelVariables } from '../../services/_sdk';
import { getCategoryTree } from '../../services/categories';
import { loadQuery } from '../../services/graphql/loader';
import { unwrapGraphQL } from '../../services/graphql/unwrap';
import { ErrorCode, isErrorCode } from '../../utils/errors';
import { logger } from '../../utils/logger';

interface SitemapEntry {
  loc: string;
  changefreq: string;
  priority: number;
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

        // The category tree comes from the shared cached fetcher rather than a
        // query of its own: this loop ran uncached, once per market × locale,
        // on every sitemap request — 1564 categories and 341 KiB per pass on
        // the largest tenant. A failure here is caught below, as before.
        const [categoriesRaw, brandsRaw] = await Promise.all([
          getCategoryTree(event, channelVars).catch(() => []),
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
          if (category.canonicalUrl) {
            entries.push({
              // Tree = hierarchy, `canonicalUrl` = address, capped at the
              // merchant's `MaxCategoryDepth`: a tree-built path is longer than
              // the real one and answers 301 or 404. `categoryPath()` strips the
              // canonical's own market/locale; the loop re-adds its own.
              loc: `/${market}/${locale}${categoryPath(category.canonicalUrl)}`,
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
  } catch (error) {
    if (isErrorCode(error, ErrorCode.TENANT_CONFIG_INVALID)) {
      // Not an unreachable API — the tenant's stored Geins config is
      // broken (see mapEnvironment in server/services/_sdk.ts). Falling
      // back to root-only entries below is still the right move, but this
      // is an ongoing SEO regression for this tenant until the config is
      // fixed, so log it distinctly instead of treating it as routine API
      // flakiness.
      logger.error(
        'Tenant config invalid while generating sitemap; falling back to root-only entries',
        error instanceof Error ? error : undefined,
        { hostname: event.context.tenant?.hostname },
      );
    }
    // If the API is unreachable (or tenant config is broken), return root
    // entries only. The sitemap will be regenerated on the next request.
  }

  // TODO: Add individual product URLs when a lightweight product listing
  // endpoint is available. Products are currently discovered via category
  // pages, but having direct product URLs in the sitemap would improve
  // crawl coverage for search engines.

  return entries;
});
