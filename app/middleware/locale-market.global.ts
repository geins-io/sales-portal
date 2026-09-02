import { COOKIE_NAMES } from '#shared/constants/storage';
import type { SupportedLocale } from '#shared/utils/locale-market';
import { SUPPORTED_LOCALE_CODES } from '#shared/utils/locale-market';

const TWO_LETTER = /^[a-z]{2}$/;

/**
 * Syncs the i18n locale and market cookie from the URL prefix, on both server
 * and client — the URL is authoritative.
 *
 * It exists because three things would otherwise disagree: the i18n plugin
 * defaults the locale to the tenant's, the server middleware sets cookies but
 * not i18n state, and SPA navigation runs neither.
 *
 * Both params are validated first. The prefixed routes are registered as
 * `/:market/:locale`, which matches ANY two segments, so `/hejhej/sv/` must not
 * reach the cookie or the market switcher.
 */
export default defineNuxtRouteMiddleware((to) => {
  let market = typeof to.params.market === 'string' ? to.params.market : null;
  let locale = typeof to.params.locale === 'string' ? to.params.locale : null;

  // Older links arrive without the pages:extend params.
  if (!market || !locale) {
    const segments = to.path.split('/').filter(Boolean);
    if (
      segments.length >= 2 &&
      TWO_LETTER.test(segments[0]!) &&
      TWO_LETTER.test(segments[1]!)
    ) {
      market = segments[0]!;
      locale = segments[1]!;
    }
  }

  if (!market || !locale) return;

  // The params branch reaches here unchecked.
  if (!TWO_LETTER.test(market) || !TWO_LETTER.test(locale)) return;

  // Before the tenant config loads the list is empty; the shape check above is
  // then the only gate, and the server has already validated this URL.
  const { availableMarkets } = useTenant();
  const marketKnown =
    availableMarkets.value.length === 0 ||
    availableMarkets.value.includes(market);

  if (marketKnown) {
    const marketCookie = useCookie(COOKIE_NAMES.MARKET, {
      maxAge: 365 * 24 * 60 * 60,
    });
    if (marketCookie.value !== market) {
      marketCookie.value = market;
    }
  }

  const { $i18n } = useNuxtApp();
  if ($i18n.locale.value !== locale) {
    const availableCodes: string[] = $i18n.locales.value.map(
      (l: string | { code: string }) => (typeof l === 'string' ? l : l.code),
    );
    if (
      availableCodes.includes(locale) &&
      (SUPPORTED_LOCALE_CODES as readonly string[]).includes(locale)
    ) {
      // setLocale lazy-loads the messages then swaps. Direct assignment
      // renders raw keys, because @nuxtjs/i18n v10 defaults to `lazy: true`.
      return $i18n.setLocale(locale as SupportedLocale);
    }
  }
});
