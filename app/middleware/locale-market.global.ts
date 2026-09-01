import { COOKIE_NAMES } from '#shared/constants/storage';
import type { SupportedLocale } from '#shared/utils/locale-market';
import { SUPPORTED_LOCALE_CODES } from '#shared/utils/locale-market';

const TWO_LETTER = /^[a-z]{2}$/;

/**
 * Global middleware that syncs i18n locale and market cookie from the URL prefix.
 *
 * Runs on BOTH server and client to ensure the i18n locale always matches the
 * URL. This is critical because:
 *
 * - The i18n-locale plugin may override the locale to the tenant's default,
 *   which differs from the URL locale (e.g. tenant default is 'sv' but URL
 *   is /se/en/). This middleware runs after plugins and corrects the mismatch
 *   before the page renders.
 *
 * - On the server, the Nitro plugin (00.locale-market.ts) sets cookies but
 *   does NOT set the i18n locale. This middleware bridges that gap.
 *
 * - On the client, SPA navigations don't trigger the Nitro plugin, so this
 *   middleware keeps cookies and i18n in sync.
 *
 * With the `pages:extend` hook, prefixed routes provide `:market` and `:locale`
 * as route params. This middleware reads those params when available, falling
 * back to manual URL segment parsing for backward compatibility.
 *
 * Both params are validated before anything is synced. The prefixed routes are
 * registered as `/:market/:locale`, which matches ANY two segments, so the
 * params branch can hand us arbitrary strings — `/hejhej/sv/` must not end up
 * in the market cookie or the market switcher.
 */
export default defineNuxtRouteMiddleware((to) => {
  // Try route params first (set by pages:extend prefixed routes)
  let market = typeof to.params.market === 'string' ? to.params.market : null;
  let locale = typeof to.params.locale === 'string' ? to.params.locale : null;

  // Fall back to manual URL segment parsing for backward compatibility
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

  // Shape check for both axes. The segment-parsing fallback above already
  // applies it; the params branch reaches here unchecked.
  if (!TWO_LETTER.test(market) || !TWO_LETTER.test(locale)) return;

  // Sync the market cookie only for a market the tenant actually sells. The
  // list is empty until the tenant config has loaded, in which case the shape
  // check above is the only gate and the server has already validated the
  // pair for this URL.
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

  // Sync i18n locale to match the URL — this is the authoritative source.
  const { $i18n } = useNuxtApp();
  if ($i18n.locale.value !== locale) {
    const availableCodes: string[] = $i18n.locales.value.map(
      (l: string | { code: string }) => (typeof l === 'string' ? l : l.code),
    );
    if (
      availableCodes.includes(locale) &&
      (SUPPORTED_LOCALE_CODES as readonly string[]).includes(locale)
    ) {
      // setLocale lazy-loads the locale's messages then swaps. Required on
      // both SSR and client because @nuxtjs/i18n v10 defaults to
      // `lazy: true` — direct assignment renders raw keys (e.g.
      // `nav.search_products` instead of "Search products…") because the
      // messages haven't been imported yet.
      return $i18n.setLocale(locale as SupportedLocale);
    }
  }
});
