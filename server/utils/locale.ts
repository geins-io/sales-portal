import type { H3Event } from 'h3';
import { COOKIE_NAMES } from '#shared/constants/storage';

/**
 * Reads the user's preferred locale from the i18n cookie on the request.
 *
 * @nuxtjs/i18n persists locale preference in the `locale` cookie.
 * Server-side API routes can read this to pass the correct languageId to
 * Geins GraphQL queries, keeping UI locale and API locale in sync.
 *
 * @returns The locale code (e.g. 'sv', 'en') or undefined if not set.
 */
export function getRequestLocale(event: H3Event): string | undefined {
  return getCookie(event, COOKIE_NAMES.LOCALE) || undefined;
}

/**
 * Reads the user's preferred market from the market cookie on the request.
 *
 * @returns The market code (e.g. 'se', 'no') or undefined if not set.
 */
export function getRequestMarket(event: H3Event): string | undefined {
  return getCookie(event, COOKIE_NAMES.MARKET) || undefined;
}
