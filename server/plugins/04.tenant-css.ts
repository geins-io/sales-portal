import type { NitroApp } from 'nitropack/types';
import { getTenant } from '../utils/tenant';
import { sanitizeTenantCss, sanitizeHtmlAttr } from '../utils/sanitize';
import { buildGoogleFontsUrl } from '#shared/utils/fonts';

/**
 * Nitro plugin that injects ALL tenant visual assets directly into rendered HTML:
 * - Blocks inactive tenants (418)
 * - Tenant theme CSS (scoped to [data-theme='name'])
 * - data-theme attribute on <html>
 * - Favicon <link>
 * - Google Fonts preconnect + stylesheet <link>
 *
 * By injecting at render time (not via useHead), these tags are raw HTML strings
 * that no client-side code touches during Vue hydration. This eliminates the
 * Flash of Unstyled Content (FOUC) completely.
 */
export default defineNitroPlugin((nitroApp: NitroApp) => {
  nitroApp.hooks.hook('render:html', async (html, { event }) => {
    const hostname = (event.context.tenant as { hostname?: string })?.hostname;
    if (!hostname) return;

    const tenant = await getTenant(hostname, event);
    if (!tenant) return;

    // Block inactive tenants
    if (!tenant.isActive) {
      // Set error status — Nuxt error page will render
      event.node.res.statusCode = 418;
      event.node.res.statusMessage = "I'm a teapot";
      return;
    }

    const themeName = tenant.theme?.name?.toLowerCase() || 'default';

    const escapedTheme = sanitizeHtmlAttr(themeName);

    // 1. Inject data-theme attribute on <html>
    html.htmlAttrs.push(` data-theme="${escapedTheme}"`);

    // 2. Inject tenant CSS
    const sanitizedCss = sanitizeTenantCss(tenant.css ?? '');
    if (sanitizedCss) {
      html.head.unshift(
        `<style data-tenant-theme="${escapedTheme}">${sanitizedCss}</style>`,
      );
    }

    // 3. Inject favicon
    const faviconUrl = tenant.branding?.faviconUrl;
    if (faviconUrl) {
      html.head.push(
        `<link rel="icon" href="${faviconUrl}" type="image/x-icon">`,
      );
    }

    // 4. Inject Google Fonts preconnect + stylesheet
    const fontsUrl = buildGoogleFontsUrl(tenant.theme?.typography);
    if (fontsUrl) {
      html.head.push(
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">',
        `<link rel="stylesheet" href="${fontsUrl}">`,
      );
    }
  });
});
