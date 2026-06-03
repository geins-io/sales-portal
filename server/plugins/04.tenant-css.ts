import type { NitroApp } from 'nitropack/types';
import {
  sanitizeTenantCss,
  sanitizeHtmlAttr,
  sanitizeUrl,
} from '../utils/sanitize';
import { buildGoogleFontsUrl } from '#shared/utils/fonts';

/**
 * Nitro plugin that injects ALL tenant visual assets directly into rendered HTML:
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
    // Tenant already resolved by 02.tenant-context — read from event context.
    const tenant = event.context.tenant?.config;
    if (!tenant) return;

    const themeName = tenant.theme?.name?.toLowerCase() || 'default';

    const escapedTheme = sanitizeHtmlAttr(themeName);

    // 1. Inject data-theme attribute on <html>
    html.htmlAttrs.push(` data-theme="${escapedTheme}"`);

    // 2. Inject tenant CSS. Emit the <style> WITHOUT a nonce attribute on
    // purpose: nuxt-security's CSP nonce plugin runs after this hook and
    // prepends the request nonce to every <style> tag it finds. If we also
    // set a nonce here the tag ships with two identical nonce attributes,
    // which is a parse error. Chromium tolerates it, but WebKit/Safari treats
    // the nonce as invalid and refuses to apply the stylesheet under a strict
    // style-src CSP (no 'unsafe-inline'), so every tenant surface color
    // (--top-bar-background, --button-background, ...) silently disappears.
    // Letting nuxt-security own the single nonce keeps the tag valid.
    const sanitizedCss = sanitizeTenantCss(tenant.css ?? '');
    if (sanitizedCss) {
      html.head.unshift(
        `<style data-tenant-theme="${escapedTheme}">${sanitizedCss}</style>`,
      );
    }

    // 3. Inject favicon (sanitize URL to allow only https: and data:image/)
    const safeFavicon = sanitizeUrl(tenant.branding?.faviconUrl ?? '');
    if (safeFavicon) {
      html.head.push(
        `<link rel="icon" href="${safeFavicon}" type="image/x-icon">`,
      );
    }

    // 4. Inject Google Fonts preconnect + stylesheet
    const fontsUrl = buildGoogleFontsUrl(tenant.theme?.typography);
    if (fontsUrl) {
      const safeFontsUrl = sanitizeHtmlAttr(fontsUrl);
      html.head.push(
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">',
        `<link rel="stylesheet" href="${safeFontsUrl}">`,
      );
    }
  });
});
