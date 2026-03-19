import { COOKIE_NAMES } from '#shared/constants/storage';

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
      /^[a-z]{2}$/.test(segments[0]!) &&
      /^[a-z]{2}$/.test(segments[1]!)
    ) {
      market = segments[0]!;
      locale = segments[1]!;
    }
  }

  if (!market || !locale) return;

  // Sync market cookie (on both server and client)
  const marketCookie = useCookie(COOKIE_NAMES.MARKET, {
    maxAge: 365 * 24 * 60 * 60,
  });
  if (marketCookie.value !== market) {
    marketCookie.value = market;
  }

  // Sync i18n locale to match the URL — this is the authoritative source.
  // Use $i18n from NuxtApp since useI18n() requires setup context.
  const { $i18n } = useNuxtApp();
  const availableCodes: string[] = $i18n.locales.value.map(
    (l: string | { code: string }) => (typeof l === 'string' ? l : l.code),
  );
  if (availableCodes.includes(locale) && $i18n.locale.value !== locale) {
    ($i18n.locale as { value: string }).value = locale;
  }
});
