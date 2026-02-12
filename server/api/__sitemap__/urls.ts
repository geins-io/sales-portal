/**
 * Dynamic sitemap source for @nuxtjs/sitemap.
 *
 * Returns an array of sitemap entries. Currently only includes static pages.
 * Will be expanded to query the Geins API for product URLs,
 * category URLs, and CMS pages once data retrieval is built.
 */
export default defineEventHandler(() => {
  return [{ loc: '/', changefreq: 'daily', priority: 1.0 }];
});
