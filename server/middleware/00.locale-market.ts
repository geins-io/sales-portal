import type { TenantConfig } from '#shared/types/tenant-config';
import { COOKIE_NAMES } from '#shared/constants/storage';
import { ROUTE_PATHS } from '#shared/constants/route-paths';
import { isPagePath } from '../utils/is-page-path';
import {
  interpretLocaleMarketPrefix,
  resolvableLocaleCodes,
  resolveLocaleMarket,
} from '#shared/utils/locale-market';

const TYPE_PREFIX_SEGMENTS = new Set(
  Object.values(ROUTE_PATHS).map((p) => p.slice(1)),
);

/**
 * Canonicalises the `/{market}/{locale}` prefix on every page URL: either the
 * pair is one the tenant serves, or the request is redirected to one.
 *
 * Lives in `server/middleware/` (not `server/plugins/`) so `sendRedirect`
 * integrates with Nitro's response pipeline — `nuxt-security` route-rule
 * headers get applied BEFORE the redirect is flushed, instead of throwing
 * `ERR_HTTP_HEADERS_SENT` from the route-rule applier after.
 *
 * The tenant context plugin runs on the Nitro `request` hook, which fires
 * BEFORE the server-middleware stack. That is why the tenant config is already
 * on the context here, and why validation cannot live in that plugin: it would
 * always read `event.context.localeMarket` unset.
 */
function isTwoLetterCode(segment: string): boolean {
  return /^[a-z]{2}$/.test(segment);
}

export default defineEventHandler((event) => {
  const fullPath = event.path || '/';

  const queryIndex = fullPath.indexOf('?');
  const path = queryIndex >= 0 ? fullPath.slice(0, queryIndex) : fullPath;
  const query = queryIndex >= 0 ? fullPath.slice(queryIndex) : '';

  // Only pages carry a locale/market prefix; prefixing a runtime route or a
  // root-served file breaks it.
  if (!isPagePath(path)) return;

  if (path.length > 1 && path.endsWith('/')) {
    const trimmed = path.replace(/\/+$/, '');
    const segmentCount = trimmed.split('/').filter(Boolean).length;
    // `/{market}/{locale}/` keeps its slash; it is the locale root, not a page.
    if (segmentCount !== 2) {
      return sendRedirect(event, trimmed + query, 301);
    }
  }

  const segments = path.split('/').filter(Boolean);

  const geinsSettings = (
    event.context.tenant?.config as TenantConfig | undefined
  )?.geinsSettings;
  const knownMarkets = geinsSettings?.availableMarkets ?? [];
  const knownLocales = geinsSettings?.availableLocales
    ? resolvableLocaleCodes(geinsSettings.availableLocales)
    : [];

  // Tenant config comes from the external merchant admin, so a tenant missing
  // these lists must degrade rather than loop toward a default that cannot
  // validate either.
  if (!geinsSettings || !knownMarkets.length || !knownLocales.length) {
    return passThroughWithoutTenantLists(event, segments, path, query);
  }

  // A type-prefixed path is content by definition, so it must never reach the
  // prefix interpreter: 'dc' is two letters and would be consumed as a market
  // attempt, and a locale-code alias after 'c'/'p' would swallow the prefix.
  if (segments[0] && TYPE_PREFIX_SEGMENTS.has(segments[0])) {
    return redirectTypePrefixedPath(event, path, query);
  }

  const { market, locale, content, attemptedPrefix } =
    interpretLocaleMarketPrefix(segments, {
      markets: knownMarkets,
      locales: knownLocales,
    });

  if (market && locale) {
    const { resolved } = resolveLocaleMarket(
      { market, locale },
      {
        availableLocales: geinsSettings.availableLocales,
        availableMarkets: geinsSettings.availableMarkets,
        defaultLocale: geinsSettings.locale,
        defaultMarket: geinsSettings.market,
      },
    );
    writeLocaleMarketCookies(event, resolved.market, resolved.locale);
    event.context.localeMarket = { market, locale };
    event.context.resolvedLocaleMarket = resolved;
    return;
  }

  // A botched prefix is corrected to the tenant defaults: a stale cookie must
  // not decide where a bad URL lands. A bare content path never had a prefix to
  // get wrong, so it keeps the cookie-then-default preference.
  const fallback = attemptedPrefix
    ? tenantDefaultMarketLocale(event)
    : resolveDefaultMarketLocale(event);

  const targetMarket = market ?? fallback.market;
  const targetLocale = locale ?? fallback.locale;
  const base = `/${targetMarket}/${targetLocale}`;
  const targetPath = content.length > 0 ? `${base}/${content.join('/')}` : base;

  // A tenant whose own defaults fail validation would redirect to a URL that
  // corrects to itself, forever.
  if (targetPath === path || `${targetPath}/` === path) {
    writeLocaleMarketCookies(event, targetMarket, targetLocale);
    event.context.localeMarket = { market: targetMarket, locale: targetLocale };
    return;
  }

  // No cookies on a corrective hop; the canonical destination writes them.
  const suffix = content.length > 0 ? '' : '/';
  return sendRedirect(event, `${targetPath}${suffix}${query}`, 302);
});

/** Pre-canonicalisation behaviour, for tenants whose config carries no lists. */
function passThroughWithoutTenantLists(
  event: import('h3').H3Event,
  segments: string[],
  path: string,
  query: string,
): unknown {
  const [first, second] = segments;
  if (first && second && isTwoLetterCode(first) && isTwoLetterCode(second)) {
    writeLocaleMarketCookies(event, first, second);
    event.context.localeMarket = { market: first, locale: second };
    return;
  }

  if (path === '/') {
    const { market, locale } = resolveDefaultMarketLocale(event);
    return sendRedirect(event, `/${market}/${locale}/${query}`, 302);
  }

  if (segments[0] && TYPE_PREFIX_SEGMENTS.has(segments[0])) {
    return redirectTypePrefixedPath(event, path, query);
  }
}

/**
 * The tenant-default target is the same for every visitor (crawlers
 * included), so it can hold a permanent 301. A cookie-derived target is
 * per-visitor: a 301 would pin it in the browser cache past the next
 * language switch, so it gets a 302.
 */
function redirectTypePrefixedPath(
  event: import('h3').H3Event,
  path: string,
  query: string,
): unknown {
  const { market, locale, fromCookie } = resolveDefaultMarketLocale(event);
  return sendRedirect(
    event,
    `/${market}/${locale}${path}${query}`,
    fromCookie ? 302 : 301,
  );
}

/** Tenant config defaults only — the correction path must ignore cookies. */
function tenantDefaultMarketLocale(event: import('h3').H3Event): {
  market: string;
  locale: string;
} {
  const geinsSettings = (
    event.context.tenant?.config as TenantConfig | undefined
  )?.geinsSettings;
  return {
    market: geinsSettings?.market || 'se',
    locale: geinsSettings?.locale?.split('-')[0] || 'sv',
  };
}

function writeLocaleMarketCookies(
  event: import('h3').H3Event,
  market: string,
  locale: string,
): void {
  const opts = {
    httpOnly: false,
    secure: !import.meta.dev,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  };
  setCookie(event, COOKIE_NAMES.MARKET, market, opts);
  setCookie(event, COOKIE_NAMES.LOCALE, locale, opts);
}

function resolveDefaultMarketLocale(event: import('h3').H3Event): {
  market: string;
  locale: string;
  /** True when a cookie decided either code. */
  fromCookie: boolean;
} {
  const marketCookie = getCookie(event, COOKIE_NAMES.MARKET);
  const localeCookie = getCookie(event, COOKIE_NAMES.LOCALE);

  // Market binds currency (ADR-020), so there is no neutral market to end on.
  const geinsSettings = (
    event.context.tenant?.config as TenantConfig | undefined
  )?.geinsSettings;
  const configMarket = geinsSettings?.market;
  const configLocale = geinsSettings?.locale;

  const market =
    marketCookie && isTwoLetterCode(marketCookie)
      ? marketCookie
      : configMarket || 'se';
  const locale =
    localeCookie && isTwoLetterCode(localeCookie)
      ? localeCookie
      : configLocale?.split('-')[0] || 'sv';

  return {
    market,
    locale,
    fromCookie: market === marketCookie || locale === localeCookie,
  };
}
