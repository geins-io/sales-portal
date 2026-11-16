import type { H3Event } from 'h3';
import type { TenantConfig } from '#shared/types/tenant-config';
import { COOKIE_NAMES } from '#shared/constants/storage';
import { resolvableLocaleCodes } from '#shared/utils/locale-market';

/**
 * Expand a short locale code (e.g. 'sv') to the full BCP-47 locale
 * (e.g. 'sv-SE') using the tenant's available locales list.
 * Returns the short code unchanged if no match is found.
 */
function expandLocale(shortCode: string, availableLocales?: string[]): string {
  if (!availableLocales?.length) return shortCode;
  // Direct match (already full format)
  if (availableLocales.includes(shortCode)) return shortCode;
  // Find BCP-47 locale that starts with the short code
  const match = availableLocales.find((l) => l.split('-')[0] === shortCode);
  return match ?? shortCode;
}

/** Two letters, or two letters and a region. */
const SHORT_CODE = /^[a-z]{2}$/;
const FULL_LOCALE = /^[a-z]{2}-[A-Z]{2}$/;

function channelSettingsOf(event: H3Event) {
  return (event.context.tenant?.config as TenantConfig | undefined)
    ?.channelSettings;
}

/** One value of a query parameter; a repeated one is no answer. */
function queryValue(event: H3Event, name: string): string | undefined {
  const value = getQuery(event)[name];
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * The locale the calling page sends as `?locale=`, when the tenant serves it.
 * With no lists to check against, only its shape is checked.
 */
function requestedLocale(event: H3Event): string | undefined {
  const value = queryValue(event, 'locale');
  if (!value) return undefined;
  const locales = channelSettingsOf(event)?.locales;
  if (!locales?.length) {
    return SHORT_CODE.test(value) || FULL_LOCALE.test(value)
      ? value
      : undefined;
  }
  if (locales.includes(value)) return value;
  return SHORT_CODE.test(value) &&
    resolvableLocaleCodes(locales).includes(value)
    ? value
    : undefined;
}

/**
 * Reads the request's locale, as a full BCP-47 code for the Geins API.
 *
 * Resolution order, the page URL first:
 * 1. A page request: `resolvedLocaleMarket`, from its URL (middleware 00).
 * 2. An API request: the locale of the page that made it, sent as
 *    `?locale=` with every call to our own `/api` routes (ADR-026). Checked
 *    against the tenant's locales.
 * 3. The `locale` cookie, for a request no page made. It holds the language
 *    of the last page any tab loaded, so it is never preferred over 1 or 2.
 * 4. The tenant config default locale.
 *
 * Undefined means nothing was requested, and callers depend on seeing it: the
 * SDK must not be handed a languageId that overrides its own default, and the
 * CMS keys such a request under 'default'. Each caller owns its last resort.
 */
export function getRequestLocale(event: H3Event): string | undefined {
  const resolved = event.context.resolvedLocaleMarket;
  if (resolved?.localeBcp47) return resolved.localeBcp47;

  const shortLocale =
    requestedLocale(event) || getCookie(event, COOKIE_NAMES.LOCALE);
  if (!shortLocale) return channelSettingsOf(event)?.defaultLocale;

  // Already in BCP-47 format (contains hyphen) — return as-is
  if (shortLocale.includes('-')) return shortLocale;

  return expandLocale(shortLocale, channelSettingsOf(event)?.locales);
}

/**
 * Reads the user's preferred market from the request.
 *
 * Resolution order:
 * 1. event.context.resolvedLocaleMarket.market — validated by middleware 00
 *    (page routes only).
 * 2. Cookie fallback — for API routes where resolvedLocaleMarket is not set.
 *
 * @returns The market code (e.g. 'se', 'no') or undefined if not set.
 */
export function getRequestMarket(event: H3Event): string | undefined {
  // Prefer the pre-validated value from middleware 00
  const resolved = event.context.resolvedLocaleMarket;
  if (resolved?.market) return resolved.market;

  // Query param → cookie fallback
  const queryMarket = getQuery(event)?.market as string | undefined;
  const marketCookie = queryMarket || getCookie(event, COOKIE_NAMES.MARKET);
  if (marketCookie) return marketCookie;

  // No cookie — use tenant's default market as fallback
  const tenantMarket = (
    event.context.tenant?.config as TenantConfig | undefined
  )?.channelSettings?.defaultMarket;
  return tenantMarket ?? undefined;
}

/**
 * The two-letter locale of the page that made an API request, for building a
 * URL prefix: the locale it sends, else the cookie, else nothing.
 */
export function getRequestedLocale(event: H3Event): string | undefined {
  const locale =
    requestedLocale(event)?.split('-')[0] ||
    getCookie(event, COOKIE_NAMES.LOCALE);
  return locale && SHORT_CODE.test(locale) ? locale : undefined;
}
