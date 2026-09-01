import { useAuthStore } from '~/stores/auth';
import { resolveLocalePrefix } from '~/utils/locale-prefix';

/**
 * Guest Middleware
 *
 * Redirects authenticated users away from public-only pages (e.g. /login).
 * If a ?redirect query param exists, redirects there; otherwise to /.
 *
 * @example
 * ```vue
 * <script setup>
 * definePageMeta({
 *   middleware: 'guest'
 * })
 * </script>
 * ```
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();

  const { tenant } = useTenant();
  const { market, prefix } = resolveLocalePrefix({
    route: to,
    marketCookie: useCookie('market').value,
    localeCookie: useCookie('locale').value,
    tenant: tenant.value,
  });

  // On first load, check session via server (cookies are sent automatically)
  if (!authStore.isInitialized) {
    await authStore.fetchUser();
  }

  if (authStore.isAuthenticated) {
    const raw = (to.query.redirect as string) || '';
    // If redirect already has locale prefix, use as-is; otherwise go to prefixed home
    const redirect = raw.startsWith(`/${market}/`) ? raw : `${prefix}/`;
    return navigateTo({ path: redirect });
  }
});
