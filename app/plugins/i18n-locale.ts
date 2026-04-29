import type { Composer } from 'vue-i18n';

/**
 * Apply the tenant's default locale to i18n on tenant load.
 *
 * IMPORTANT: The URL locale prefix (`/:market/:locale/...`) is the
 * authoritative source. The global middleware `locale-market.global.ts`
 * already syncs i18n from the URL on every navigation. This plugin only
 * fills in the locale when the URL has NO prefix (e.g. `/cart` accessed
 * directly without a locale prefix) so the tenant default applies instead
 * of the global Nuxt `defaultLocale`.
 *
 * Without the URL guard, a tenant whose default locale differs from the
 * URL locale would race the middleware: middleware sets the URL locale,
 * then this watch fires when the tenant config resolves and overrides
 * to the tenant default. SSR `useFetch` calls then send the wrong
 * `?locale=...` query and get back 404s on hard refresh — works on
 * client-side navigation because the watch has already settled.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { tenant } = useTenant();
  const i18n = nuxtApp.$i18n as Composer;
  const route = useRoute();

  watch(
    () => {
      const raw = tenant.value;
      if (!raw) return undefined;
      return (raw as unknown as Record<string, unknown>).locale as
        | string
        | undefined;
    },
    async (tenantLocale) => {
      if (!tenantLocale) return;
      if (hasUrlLocalePrefix(route)) return;

      const code = tenantLocale.split('-')[0] ?? tenantLocale;
      if (code !== i18n.locale.value && isAvailableLocale(i18n, code)) {
        await i18n.setLocale(code);
      }
    },
    { immediate: true },
  );
});

/**
 * Detect a `/:market/:locale/...` URL prefix without depending on the
 * route name being a `locale-*` prefixed copy. Both route params (set
 * by `pages:extend`) and raw URL segments are checked, since plugin
 * setup may run before route params are populated for catch-all routes.
 */
export function hasUrlLocalePrefix(route: {
  params?: Record<string, unknown>;
  path?: string;
}): boolean {
  const localeParam = route.params?.locale;
  if (typeof localeParam === 'string' && localeParam) {
    return true;
  }
  const segments = (route.path ?? '/').split('/').filter(Boolean);
  return (
    segments.length >= 2 &&
    /^[a-z]{2}$/.test(segments[0]!) &&
    /^[a-z]{2}$/.test(segments[1]!)
  );
}

function isAvailableLocale(
  i18n: Composer,
  code: string,
): code is Composer['locale']['value'] {
  return (i18n.availableLocales as string[]).includes(code);
}
