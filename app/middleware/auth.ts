import { useAuthStore } from '~/stores/auth';
import { resolveLocalePrefix } from '~/utils/locale-prefix';

/**
 * Authentication Middleware
 *
 * Protects routes that require authentication.
 *
 * @example
 * ```vue
 * <script setup>
 * definePageMeta({ middleware: 'auth' })
 * </script>
 * ```
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();

  const { tenant } = useTenant();
  const { prefix } = resolveLocalePrefix({
    route: to,
    marketCookie: useCookie('market').value,
    localeCookie: useCookie('locale').value,
    tenant: tenant.value,
  });

  // On first load, check session via server (cookies are sent automatically)
  if (!authStore.isInitialized) {
    await authStore.fetchUser();
  }

  if (!authStore.isAuthenticated) {
    const redirectPath = to.fullPath;
    return navigateTo({
      path: `${prefix}/login`,
      query: redirectPath !== '/' ? { redirect: redirectPath } : undefined,
    });
  }
});
