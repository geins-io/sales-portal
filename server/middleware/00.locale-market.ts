import { COOKIE_NAMES } from '#shared/constants/storage';
import { ROUTE_PATHS } from '#shared/constants/route-paths';

const TYPE_PREFIX_SEGMENTS = new Set(
  Object.values(ROUTE_PATHS).map((p) => p.slice(1)),
);

/**
 * Parses locale/market-prefixed URLs, normalises trailing slashes, and
 * issues the root-path locale redirect.
 *
 * Lives in `server/middleware/` (not `server/plugins/`) so `sendRedirect`
 * integrates with Nitro's response pipeline — `nuxt-security` route-rule
 * headers get applied BEFORE the redirect is flushed instead of after,
 * which used to throw `ERR_HTTP_HEADERS_SENT` from the route-rule applier.
 *
 * Behaviour:
 * - Skip non-page routes (API, static assets, internal).
 * - Trailing-slash normalisation: redirect `/foo/` → `/foo` (301), except
 *   for bare root `/` and the locale/market root `/{market}/{locale}/`.
 * - For `/{market}/{locale}/...`: write market+locale cookies and stash
 *   the pair on `event.context.localeMarket` for downstream validation.
 * - For root `/`: redirect (302) to `/{market}/{locale}/` using cookie
 *   values or env-based fallbacks. Tenant config isn't available at this
 *   stage, so cookie/env-based fallbacks are the best we can do.
 *
 * Does NOT validate market/locale against the resolved tenant config —
 * that's `app/middleware/locale-market.client.ts`'s job (runs after the
 * tenant context plugin).
 */
function isTwoLetterCode(segment: string): boolean {
  return /^[a-z]{2}$/.test(segment);
}

export default defineEventHandler((event) => {
  const fullPath = event.path || '/';

  // Skip non-page routes
  if (
    fullPath.startsWith('/api/') ||
    fullPath.startsWith('/_nuxt/') ||
    fullPath.startsWith('/__nuxt')
  ) {
    return;
  }

  const queryIndex = fullPath.indexOf('?');
  const path = queryIndex >= 0 ? fullPath.slice(0, queryIndex) : fullPath;
  const query = queryIndex >= 0 ? fullPath.slice(queryIndex) : '';

  // Trailing-slash normalisation
  if (path.length > 1 && path.endsWith('/')) {
    const trimmed = path.replace(/\/+$/, '');
    const segmentCount = trimmed.split('/').filter(Boolean).length;
    // Keep the trailing slash on `/{market}/{locale}/` (segmentCount === 2)
    if (segmentCount !== 2) {
      return sendRedirect(event, trimmed + query, 301);
    }
  }

  const segments = path.split('/').filter(Boolean);

  // Locale/market-prefixed paths: write cookies + context, no redirect
  if (segments.length >= 2) {
    const [first, second] = segments;
    if (isTwoLetterCode(first!) && isTwoLetterCode(second!)) {
      const market = first!;
      const locale = second!;

      setCookie(event, COOKIE_NAMES.MARKET, market, {
        httpOnly: false,
        secure: !import.meta.dev,
        sameSite: 'lax',
        path: '/',
        maxAge: 365 * 24 * 60 * 60,
      });
      setCookie(event, COOKIE_NAMES.LOCALE, locale, {
        httpOnly: false,
        secure: !import.meta.dev,
        sameSite: 'lax',
        path: '/',
        maxAge: 365 * 24 * 60 * 60,
      });

      event.context.localeMarket = { market, locale };
      return;
    }
  }

  // Root path → redirect to the locale-prefixed root
  if (path === '/') {
    const { market, locale } = resolveDefaultMarketLocale(event);
    return sendRedirect(event, `/${market}/${locale}/${query}`, 302);
  }

  // Type-prefixed paths without /{market}/{locale}/ (e.g. /p/foo/bar coming
  // in from Geins Merchant Center links): 301 to the locale-prefixed canonical
  // so the page renders with proper canonical metadata and search engines do
  // not see two URLs for the same entity.
  if (segments[0] && TYPE_PREFIX_SEGMENTS.has(segments[0])) {
    const { market, locale } = resolveDefaultMarketLocale(event);
    return sendRedirect(event, `/${market}/${locale}${path}${query}`, 301);
  }

  // Non-prefixed URLs pass through.
});

function resolveDefaultMarketLocale(event: import('h3').H3Event): {
  market: string;
  locale: string;
} {
  const marketCookie = getCookie(event, COOKIE_NAMES.MARKET);
  const localeCookie = getCookie(event, COOKIE_NAMES.LOCALE);

  const market =
    marketCookie && isTwoLetterCode(marketCookie) ? marketCookie : 'se';
  const locale =
    localeCookie && isTwoLetterCode(localeCookie)
      ? localeCookie
      : process.env.GEINS_LOCALE?.split('-')[0] || 'sv';

  return { market, locale };
}
