import { COOKIE_NAMES } from '#shared/constants/storage';

/**
 * Checks if a string is exactly 2 lowercase ASCII letters.
 */
function isTwoLetterCode(segment: string): boolean {
  return /^[a-z]{2}$/.test(segment);
}

/**
 * Nitro plugin that parses locale/market-prefixed URLs and sets cookies/context.
 *
 * Runs BEFORE the Nuxt router and before tenant context resolution.
 *
 * For requests to `/{market}/{locale}/...`:
 * 1. Checks if first two segments are both 2-letter lowercase codes
 * 2. Sets cookies with the extracted values
 * 3. Stores parsed values in `event.context.localeMarket` for downstream validation
 *
 * Does NOT rewrite the URL — Vue Router handles prefixed routes natively
 * via the `pages:extend` hook in nuxt.config.ts that registers
 * `/:market/:locale/...` versions of all page routes.
 *
 * Does NOT validate against tenant config (not available yet at this stage).
 * The validation middleware (locale-market-validate.ts) handles that after
 * tenant context is resolved.
 *
 * For the root path `/`:
 * - Redirects to `/{market}/{locale}/` using cookie values or env-based fallbacks
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const fullPath = event.path || '/';

    // Skip non-page routes (API, static assets, internal)
    if (
      fullPath.startsWith('/api/') ||
      fullPath.startsWith('/_nuxt/') ||
      fullPath.startsWith('/__nuxt')
    ) {
      return;
    }

    // Separate pathname from query string before segment parsing
    const queryIndex = fullPath.indexOf('?');
    const path = queryIndex >= 0 ? fullPath.slice(0, queryIndex) : fullPath;
    const query = queryIndex >= 0 ? fullPath.slice(queryIndex) : '';

    // Normalize trailing slashes: redirect paths with trailing slash to non-trailing version.
    // Exceptions: bare root "/" and locale/market root "/{xx}/{yy}/" (exactly 2 segments + slash)
    if (path.length > 1 && path.endsWith('/')) {
      const trimmed = path.replace(/\/+$/, '');
      const segmentCount = trimmed.split('/').filter(Boolean).length;
      // Allow trailing slash only for root "/" (already excluded) and /{market}/{locale}/
      if (segmentCount !== 2) {
        return sendRedirect(event, trimmed + query, 301);
      }
    }

    const segments = path.split('/').filter(Boolean);

    // Check if first two segments are market/locale codes (both 2-letter lowercase)
    if (segments.length >= 2) {
      const [first, second] = segments;

      if (isTwoLetterCode(first!) && isTwoLetterCode(second!)) {
        const market = first!;
        const locale = second!;

        // Set cookies (will be validated later by the middleware)
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

        // Store parsed values in event context for downstream validation
        event.context.localeMarket = { market, locale };

        // No URL rewriting — Vue Router handles prefixed routes natively
        return;
      }
    }

    // Root path redirect: `/` -> `/{market}/{locale}/`
    if (path === '/') {
      const marketCookie = getCookie(event, COOKIE_NAMES.MARKET);
      const localeCookie = getCookie(event, COOKIE_NAMES.LOCALE);

      // Use cookie values or env-based fallbacks (tenant config not available yet)
      const market =
        marketCookie && isTwoLetterCode(marketCookie) ? marketCookie : 'se';
      const locale =
        localeCookie && isTwoLetterCode(localeCookie)
          ? localeCookie
          : process.env.GEINS_LOCALE?.split('-')[0] || 'sv';

      return sendRedirect(event, `/${market}/${locale}/${query}`, 302);
    }

    // URLs without a valid market/locale prefix pass through unchanged.
  });
});
