/**
 * Backward-compatibility redirect for old bare URLs.
 *
 * Old URLs without a type prefix (e.g. /se/sv/material/epoxy) are
 * 301-redirected to the /c/ prefixed equivalent (/se/sv/c/material/epoxy).
 *
 * Skips:
 * - Non-GET requests
 * - API / Nuxt internal paths
 * - Paths that already have a type prefix (/c/, /p/, /b/, /l/, /s/, /dc/)
 * - Known static routes (cart, checkout, login, etc.)
 * - Homepage (no remaining path after market/locale)
 */
export default defineEventHandler((event) => {
  const method = event.method?.toUpperCase();
  if (method !== 'GET') return;

  const fullPath = event.path || '';

  // Skip internal / API paths
  if (
    fullPath.startsWith('/api/') ||
    fullPath.startsWith('/_nuxt/') ||
    fullPath.startsWith('/__nuxt')
  ) {
    return;
  }

  // Split path and query string
  const qIdx = fullPath.indexOf('?');
  const pathname = qIdx >= 0 ? fullPath.slice(0, qIdx) : fullPath;
  const queryString = qIdx >= 0 ? fullPath.slice(qIdx + 1) : '';

  // Match /{market}/{locale}/{rest} pattern
  const match = pathname.match(/^\/([a-z]{2})\/([a-z]{2})(\/.*)?$/);
  if (!match) return;

  const market = match[1];
  const locale = match[2];
  const rest = match[3] || '';

  // Homepage — nothing after market/locale
  if (!rest || rest === '/') return;

  // Get the first segment after market/locale
  const segments = rest.split('/').filter(Boolean);
  if (segments.length === 0) return;

  const firstSegment = segments[0] as string;

  // Known type prefixes — already using new URL scheme
  const typePrefixes = new Set(['c', 'p', 'b', 'l', 's', 'dc']);
  if (typePrefixes.has(firstSegment)) return;

  // Known static routes — these are real page files, not legacy paths
  const staticRoutes = new Set([
    'cart',
    'checkout',
    'login',
    'portal',
    'contact',
    'apply-for-account',
    'reset-password',
    'search',
    'order-confirmation',
    'quote-confirmation',
    'elements',
    'error-test',
    'preview-widgets',
  ]);
  if (staticRoutes.has(firstSegment)) return;

  // Redirect bare path to /c/ prefixed version
  const redirectPath = `/${market}/${locale}/c${rest}`;
  const redirectUrl =
    queryString.length > 0 ? `${redirectPath}?${queryString}` : redirectPath;

  return sendRedirect(event, redirectUrl, 301);
});
