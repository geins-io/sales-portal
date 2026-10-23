import { updateSiteConfig } from '#site-config/server';
import { buildSiteUrl, isIndexable } from '../utils/seo';
import { getRequestLocale } from '../utils/locale';

/**
 * Sets per-tenant site config on every request, overriding the static site
 * config from nuxt.config.ts with tenant-specific values.
 *
 * Middleware rather than a `site-config:init` hook: nuxt-site-config fires that
 * hook from a request hook registered before ours, so the tenant is not
 * resolved yet, and here `00.locale-market` has already resolved the locale.
 */
export default defineEventHandler((event) => {
  // Skip for health check paths
  const path = event.path || '';
  if (path.startsWith('/api/health')) return;

  const tenant = event.context.tenant?.config;
  if (!tenant) return;

  // getRequestLocale already tried the tenant config, so only a literal
  // is a live fallback here.
  const requestLocale = getRequestLocale(event) ?? 'sv-SE';

  updateSiteConfig(event, {
    _context: 'tenant-seo',
    _priority: 10,
    url: buildSiteUrl(tenant.hostname),
    name: tenant.branding.name,
    description: tenant.seo?.defaultDescription ?? '',
    defaultLocale: tenant.geinsSettings.locale,
    currentLocale: requestLocale,
    indexable: isIndexable(tenant.seo?.robots),
  });
});
