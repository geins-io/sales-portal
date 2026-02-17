import type { H3Event } from 'h3';
import { resolveTenant } from '../utils/tenant';
import { buildSiteUrl, isIndexable } from '../utils/seo';
import { getRequestLocale } from '../utils/locale';

interface SiteConfigInitContext {
  event: H3Event;
  siteConfig: { push: (config: Record<string, unknown>) => void };
}

/**
 * Nitro plugin that sets per-tenant site config on every request.
 * Hooks into the site-config:init event provided by nuxt-site-config
 * (part of @nuxtjs/seo) to override the static site config from nuxt.config.ts
 * with dynamic, tenant-specific values.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook(
    'site-config:init',
    async (ctx: SiteConfigInitContext) => {
      const { event, siteConfig } = ctx;

      // Skip for health check paths
      const path = event.path || '';
      if (path.startsWith('/api/health')) return;

      const hostname = (event.context.tenant as { hostname?: string })
        ?.hostname;
      if (!hostname) return;

      const tenant = await resolveTenant(hostname, event);
      if (!tenant) return;

      const requestLocale = getRequestLocale(event);

      siteConfig.push({
        _context: 'tenant-seo',
        _priority: 10,
        url: buildSiteUrl(hostname),
        name: tenant.branding.name,
        description: tenant.seo?.defaultDescription ?? '',
        defaultLocale: tenant.geinsSettings.locale,
        currentLocale: requestLocale ?? tenant.geinsSettings.locale,
        indexable: isIndexable(tenant.seo?.robots),
      });
    },
  );
});
