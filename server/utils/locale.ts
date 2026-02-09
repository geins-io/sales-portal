import type { H3Event } from 'h3';

/**
 * Reads the user's preferred locale from the i18n cookie on the request.
 *
 * @nuxtjs/i18n persists locale preference in the `i18n_redirected` cookie.
 * Server-side API routes can read this to pass the correct languageId to
 * Geins GraphQL queries, keeping UI locale and API locale in sync.
 *
 * @returns The locale code (e.g. 'sv', 'en') or undefined if not set.
 */
export function getRequestLocale(event: H3Event): string | undefined {
  return getCookie(event, 'i18n_redirected') || undefined;
}
