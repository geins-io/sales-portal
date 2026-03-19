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
 * Reads the user's preferred locale from the i18n cookie on the request,
 * expanded to the full BCP-47 locale code using the tenant config.
 *
 * The cookie stores short codes ('sv', 'en') but the Geins GraphQL API
 * requires full BCP-47 codes ('sv-SE', 'en-US'). This function maps
 * between the two using the tenant's availableLocales.
 *
 * @returns The full locale code (e.g. 'sv-SE') or undefined if not set.
 */
export function getRequestLocale(event: H3Event): string | undefined {
  const shortLocale = getCookie(event, COOKIE_NAMES.LOCALE);
  if (!shortLocale) return undefined;

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
 * Reads the user's preferred market from the market cookie on the request.
 *
 * @returns The market code (e.g. 'se', 'no') or undefined if not set.
 */
export function getRequestMarket(event: H3Event): string | undefined {
  return getCookie(event, COOKIE_NAMES.MARKET) || undefined;
}
