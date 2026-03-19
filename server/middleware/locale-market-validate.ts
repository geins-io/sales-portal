import type { TenantConfig } from '#shared/types/tenant-config';
import { COOKIE_NAMES } from '#shared/constants/storage';

/**
 * Extracts 2-letter locale codes from full locale strings.
 * e.g. ['sv-SE', 'en-US'] -> Set(['sv', 'en'])
 */
function extractShortLocales(fullLocales: string[]): Set<string> {
  const shorts = new Set<string>();
  for (const l of fullLocales) {
    const short = l.split('-')[0];
    if (short && /^[a-z]{2}$/.test(short)) {
      shorts.add(short);
    }
  }
  return shorts;
}

/**
 * Reads valid locales and markets from the resolved tenant config.
 * Returns null when tenant context is unavailable (nothing to validate against).
 */
function getTenantLocaleConfig(event: { context: Record<string, unknown> }): {
  validLocales: Set<string>;
  validMarkets: Set<string>;
  defaultLocale: string;
  defaultMarket: string;
} | null {
  const config = (event.context.tenant as { config?: TenantConfig } | undefined)
    ?.config;

  if (!config?.geinsSettings) {
    return null;
  }

  const { geinsSettings } = config;

  const validLocales =
    geinsSettings.availableLocales.length > 0
      ? extractShortLocales(geinsSettings.availableLocales)
      : new Set(['en', 'sv']);

  const validMarkets =
    geinsSettings.availableMarkets.length > 0
      ? new Set(geinsSettings.availableMarkets)
      : new Set(['se']);

  // Default locale: extract short code from the tenant's default locale
  const defaultLocaleShort = geinsSettings.locale?.split('-')[0];
  const defaultLocale =
    defaultLocaleShort && validLocales.has(defaultLocaleShort)
      ? defaultLocaleShort
      : 'en';

  // Default market: tenant's configured default market
  const defaultMarket =
    geinsSettings.market && validMarkets.has(geinsSettings.market)
      ? geinsSettings.market
      : 'se';

  return { validLocales, validMarkets, defaultLocale, defaultMarket };
}

/**
 * Server middleware that validates the locale/market extracted by the Nitro plugin.
 *
 * Runs AFTER the tenant context plugin (01.tenant-context.ts), so
 * `event.context.tenant.config` is available for validation.
 *
 * The Nitro plugin (00.locale-market.ts) parsed the prefix and stored it
 * in `event.context.localeMarket`. The URL is NOT rewritten — Vue Router
 * handles prefixed routes natively via the `pages:extend` hook.
 *
 * This middleware validates the extracted values against the tenant's
 * configured markets and locales. If invalid, it redirects to a corrected
 * prefixed URL.
 *
 * If no `localeMarket` in context: the URL had no prefix, nothing to validate.
 */
export default defineEventHandler((event) => {
  const localeMarket = event.context.localeMarket as
    | { market: string; locale: string }
    | undefined;

  // No locale/market was extracted by the plugin — nothing to validate
  if (!localeMarket) {
    return;
  }

  const tenantConfig = getTenantLocaleConfig(event);

  // No tenant config available — can't validate, trust the plugin's values
  if (!tenantConfig) {
    return;
  }

  const { market, locale } = localeMarket;
  const { validLocales, validMarkets, defaultLocale, defaultMarket } =
    tenantConfig;

  const marketValid = validMarkets.has(market);
  const localeValid = validLocales.has(locale);

  // Both valid — nothing to do
  if (marketValid && localeValid) {
    return;
  }

  // Extract the remaining path (after the market/locale prefix) from the original URL.
  // The URL is NOT rewritten, so we need to strip the prefix ourselves for redirect construction.
  const fullPath = event.path || '/';
  const queryIndex = fullPath.indexOf('?');
  const path = queryIndex >= 0 ? fullPath.slice(0, queryIndex) : fullPath;
  const query = queryIndex >= 0 ? fullPath.slice(queryIndex) : '';

  const segments = path.split('/').filter(Boolean);
  // Skip the first two segments (market/locale) to get the remaining path
  const remainingSegments = segments.slice(2);
  const remainingPath =
    remainingSegments.length > 0 ? '/' + remainingSegments.join('/') : '/';

  const correctedMarket = marketValid ? market : defaultMarket;
  const correctedLocale = localeValid ? locale : defaultLocale;

  // Reset cookies to corrected values before redirecting so stale values
  // don't persist and cause repeated redirect loops.
  const cookieOpts = {
    httpOnly: false,
    secure: !import.meta.dev,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  };
  setCookie(event, COOKIE_NAMES.LOCALE, correctedLocale, cookieOpts);
  setCookie(event, COOKIE_NAMES.MARKET, correctedMarket, cookieOpts);

  // Redirect to corrected prefixed URL
  const redirectPath =
    remainingPath === '/'
      ? `/${correctedMarket}/${correctedLocale}/${query}`
      : `/${correctedMarket}/${correctedLocale}${remainingPath}${query}`;

  return sendRedirect(event, redirectPath, 302);
});
