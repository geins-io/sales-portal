import type { H3Event } from 'h3';
import type { TenantConfig } from '#shared/types/tenant-config';
import { COOKIE_NAMES } from '#shared/constants/storage';

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

/**
 * Reads the user's preferred locale from the request, returning a full BCP-47
 * locale code for use with the Geins GraphQL API.
 *
 * Resolution order:
 * 1. event.context.resolvedLocaleMarket.localeBcp47 — already validated and
 *    BCP-47 expanded by plugin 01 (page routes only).
 * 2. Cookie fallback — for API routes where resolvedLocaleMarket is not set.
 *    The cookie stores short codes ('sv', 'en') which are expanded using the
 *    tenant's availableLocales list.
 *
 * @returns The full locale code (e.g. 'sv-SE') or undefined if not set.
 */
export function getRequestLocale(event: H3Event): string | undefined {
  // Prefer the pre-validated, BCP-47 expanded value from plugin 01
  const resolved = event.context.resolvedLocaleMarket;
  if (resolved?.localeBcp47) return resolved.localeBcp47;

  // Cookie fallback for API routes where resolvedLocaleMarket is not set
  const shortLocale = getCookie(event, COOKIE_NAMES.LOCALE);
  if (!shortLocale) {
    // No cookie — use tenant's first available locale as fallback
    const tenantLocales = (
      event.context.tenant?.config as TenantConfig | undefined
    )?.geinsSettings?.availableLocales;
    return tenantLocales?.[0] ?? undefined;
  }

  // Already in BCP-47 format (contains hyphen) — return as-is
  if (shortLocale.includes('-')) return shortLocale;

  const tenantConfig = event.context.tenant?.config as TenantConfig | undefined;
  const availableLocales = tenantConfig?.geinsSettings?.availableLocales;

  const expanded = expandLocale(shortLocale, availableLocales);

  // If expansion didn't change anything (no tenant config available, e.g. internal SSR fetch),
  // return undefined so the caller falls back to the SDK's default locale (already BCP-47).
  if (expanded === shortLocale && !shortLocale.includes('-')) {
    return undefined;
  }

  return expanded;
}

/**
 * Reads the user's preferred market from the request.
 *
 * Resolution order:
 * 1. event.context.resolvedLocaleMarket.market — validated by plugin 01
 *    (page routes only).
 * 2. Cookie fallback — for API routes where resolvedLocaleMarket is not set.
 *
 * @returns The market code (e.g. 'se', 'no') or undefined if not set.
 */
export function getRequestMarket(event: H3Event): string | undefined {
  // Prefer the pre-validated value from plugin 01
  const resolved = event.context.resolvedLocaleMarket;
  if (resolved?.market) return resolved.market;

  // Cookie fallback for API routes where resolvedLocaleMarket is not set
  const marketCookie = getCookie(event, COOKIE_NAMES.MARKET);
  if (marketCookie) return marketCookie;

  // No cookie — use tenant's default market as fallback
  const tenantMarket = (
    event.context.tenant?.config as TenantConfig | undefined
  )?.geinsSettings?.market;
  return tenantMarket ?? undefined;
}
