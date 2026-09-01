import { useAuthStore } from '~/stores/auth';
import { resolveLocalePrefix } from '~/utils/locale-prefix';

/**
 * Authentication Middleware
 *
 * Protects routes that require authentication.
 * Optionally checks user roles via route meta.
 *
 * @example
 * ```vue
 * <script setup>
 * // Any authenticated user
 * definePageMeta({ middleware: 'auth' })
 *
 * // Role-gated (portal users only)
 * definePageMeta({ middleware: 'auth', roles: ['wholesale'] })
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

  // Optional role check from route meta
  const roles = to.meta.roles;
  if (roles?.length && !authStore.hasAnyRole(roles)) {
    return navigateTo({ path: `${prefix}/` });
  }
});
