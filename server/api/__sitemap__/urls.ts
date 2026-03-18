import type { TenantConfig } from '#shared/types/tenant-config';

/**
 * Dynamic sitemap source for @nuxtjs/sitemap.
 *
 * Returns an array of sitemap entries with locale/market-prefixed URLs.
 * Reads available markets and locales from tenant config so each
 * market/locale combination gets its own entry.
 *
 * Will be expanded to query the Geins API for product URLs,
 * category URLs, and CMS pages once data retrieval is built.
 */
export default defineEventHandler((event) => {
  const config = (event.context.tenant as { config?: TenantConfig } | undefined)
    ?.config;

  const markets = config?.geinsSettings?.availableMarkets ?? ['se'];
  const locales = (config?.geinsSettings?.availableLocales ?? ['en']).map(
    (l) => l.split('-')[0]!,
  );

  // Generate root entries for each market/locale combination
  const entries: Array<{
    loc: string;
    changefreq: string;
    priority: number;
  }> = [];

  for (const market of markets) {
    for (const locale of locales) {
      entries.push({
        loc: `/${market}/${locale}/`,
        changefreq: 'daily',
        priority: 1.0,
      });
    }
  }

  return entries;
});
