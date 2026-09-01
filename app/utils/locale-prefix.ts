/**
 * Shared `/{market}/{locale}` prefix resolution for redirect targets.
 *
 * The four client-side redirect sites (middleware/auth, middleware/guest,
 * middleware/feature, error.vue) must agree on where the pair comes from:
 *
 * 1. the route — `:market`/`:locale` params from the prefixed routes
 *    (`pages:extend`), else the first two path segments
 * 2. cookies
 * 3. tenant config defaults
 * 4. the 'se'/'sv' pair
 *
 * The route comes first because it is the only source available on a
 * cookieless first request: `useCookie` reads REQUEST headers while
 * `server/middleware/00.locale-market.ts` sets them on the RESPONSE, and the
 * tenant may still be unresolved. Without it a deep link to `/se/nb/portal`
 * redirects to `/se/sv/login` and silently drops the visitor's language.
 */

interface RouteLike {
  params?: Record<string, unknown>;
  path?: string;
}

const SHORT_CODE = /^[a-z]{2}$/;

function shortCode(value: unknown): string | null {
  return typeof value === 'string' && SHORT_CODE.test(value) ? value : null;
}

/**
 * The market/locale pair a route carries, or null when it is unprefixed.
 *
 * Params win; the path parse is the fallback for routes that did not match a
 * prefixed pattern, which includes the error page's 404s.
 */
export function routeLocaleMarket(
  route: RouteLike | null | undefined,
): { market: string; locale: string } | null {
  const market = shortCode(route?.params?.market);
  const locale = shortCode(route?.params?.locale);
  if (market && locale) return { market, locale };

  const segments = (route?.path ?? '').split('/').filter(Boolean);
  const pathMarket = shortCode(segments[0]);
  const pathLocale = shortCode(segments[1]);
  if (pathMarket && pathLocale)
    return { market: pathMarket, locale: pathLocale };

  return null;
}

/** Resolves the prefix, e.g. '/se/nb'. Never returns a trailing slash. */
export function resolveLocalePrefix(sources: {
  route?: RouteLike | null;
  marketCookie?: string | null;
  localeCookie?: string | null;
  tenant?: { market?: string | null; locale?: string | null } | null;
}): { market: string; locale: string; prefix: string } {
  const fromRoute = routeLocaleMarket(sources.route);

  const market =
    fromRoute?.market || sources.marketCookie || sources.tenant?.market || 'se';
  const locale =
    fromRoute?.locale ||
    sources.localeCookie ||
    sources.tenant?.locale?.split('-')[0] ||
    'sv';

  return { market, locale, prefix: `/${market}/${locale}` };
}
