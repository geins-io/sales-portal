import type { NitroApp } from 'nitropack/types';

/**
 * Strips the inline `onerror` sentinel that @nuxt/image adds to every
 * server-rendered <img>:
 *
 *   onerror="this.setAttribute('data-error', 1)"
 *
 * It is an inline event handler, which the production CSP blocks with
 * `script-src-attr 'none'`. WebKit/Safari logs a violation for each one and
 * refuses to run it. The attribute only exists to flag images that fail before
 * hydration; @nuxt/image reattaches an error handler on mount (a property
 * assignment, not an inline attribute), so removing the SSR sentinel costs
 * nothing observable while keeping the strict script CSP intact.
 *
 * The match is intentionally narrow: only this exact handler (the single/HTML
 * encoded quote forms) is removed, never arbitrary author markup.
 */
const NUXT_IMG_ONERROR_RE =
  /\s+onerror="this\.setAttribute\((?:&#39;|')data-error(?:&#39;|'),\s*1\)"/g;

export default defineNitroPlugin((nitroApp: NitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    html.body = html.body.map((chunk) =>
      chunk.replace(NUXT_IMG_ONERROR_RE, ''),
    );
  });
});
