import { COOKIE_NAMES } from '#shared/constants/storage';

/**
 * Client-side global middleware that syncs locale and market state
 * from the URL prefix on every navigation.
 *
 * On the server, the Nitro plugin (server/plugins/00.locale-market.ts) handles
 * cookie setting and context storage. This client-side middleware
 * complements it by keeping the i18n locale and market cookie in sync
 * during SPA navigations where the server plugin doesn't run.
 *
 * With the `pages:extend` hook, prefixed routes provide `:market` and `:locale`
 * as route params. This middleware reads those params when available, falling
 * back to manual URL segment parsing for backward compatibility.
 */
export default defineNuxtRouteMiddleware((to) => {
  // Only run on the client — server-side is handled by Nitro plugin
  if (import.meta.server) return;

  // Try route params first (set by pages:extend prefixed routes)
  let market = typeof to.params.market === 'string' ? to.params.market : null;
  let locale = typeof to.params.locale === 'string' ? to.params.locale : null;

  // Fall back to manual URL segment parsing for backward compatibility
  if (!market || !locale) {
    const segments = to.path.split('/').filter(Boolean);
    if (
      segments.length >= 2 &&
      /^[a-z]{2}$/.test(segments[0]!) &&
      /^[a-z]{2}$/.test(segments[1]!)
    ) {
      market = segments[0]!;
      locale = segments[1]!;
    }
  }

  if (!market || !locale) return;

  // Set market cookie
  const marketCookie = useCookie(COOKIE_NAMES.MARKET, {
    maxAge: 365 * 24 * 60 * 60,
  });
  if (marketCookie.value !== market) {
    marketCookie.value = market;
  }

  // Sync i18n locale — use $i18n from NuxtApp since useI18n() requires setup context
  const { $i18n } = useNuxtApp();
  const availableCodes: string[] = $i18n.locales.value.map(
    (l: string | { code: string }) => (typeof l === 'string' ? l : l.code),
  );
  if (availableCodes.includes(locale) && $i18n.locale.value !== locale) {
    ($i18n.locale as { value: string }).value = locale;
  }
});
