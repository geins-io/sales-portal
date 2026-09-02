/**
 * Whether a request path is a page — something that can carry a
 * `/{market}/{locale}` prefix and render HTML.
 *
 * Everything else is a runtime route that must pass through untouched: API
 * handlers, Nuxt internals, the image optimiser (`/_ipx/`), and the files
 * served from the site root (`robots.txt`, `sitemap.xml`,
 * `.well-known/security.txt`). Prefixing any of those breaks them, and they
 * are all reachable at fixed URLs that must not move.
 *
 * Pass a path with the query string already stripped.
 */
export function isPagePath(path: string): boolean {
  if (
    path.startsWith('/api/') ||
    path.startsWith('/_nuxt/') ||
    path.startsWith('/__nuxt') ||
    path.startsWith('/favicon') ||
    path.startsWith('/robots.txt') ||
    path.startsWith('/sitemap') ||
    path.startsWith('/healthz')
  ) {
    return false;
  }

  // A dot means a filename, never a page slug in this app.
  if (path.includes('.')) return false;

  // Nuxt reserves a leading underscore for runtime routes; `/_ipx/` is the
  // image optimiser and can be hit without an extension.
  const firstSegment = path.split('/').filter(Boolean)[0];
  if (firstSegment?.startsWith('_')) return false;

  return true;
}
