import { useAuthStore } from '~/stores/auth';

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

  // Build locale/market prefix from cookies. Cookieless fallback: the tenant
  // config default locale, then 'sv' to mirror the 'se' market last resort.
  const { tenant } = useTenant();
  const market = useCookie('market').value || 'se';
  const locale =
    useCookie('locale').value || tenant.value?.locale?.split('-')[0] || 'sv';
  const prefix = `/${market}/${locale}`;

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
