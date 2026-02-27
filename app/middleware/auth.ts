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

  // On first load, check session via server (cookies are sent automatically)
  if (!authStore.isInitialized) {
    await authStore.fetchUser();
  }

  if (!authStore.isAuthenticated) {
    const redirectPath = to.fullPath;
    return navigateTo({
      path: '/login',
      query: redirectPath !== '/' ? { redirect: redirectPath } : undefined,
    });
  }

  // Optional role check from route meta
  const roles = to.meta.roles;
  if (roles?.length && !authStore.hasAnyRole(roles)) {
    return navigateTo({ path: '/' });
  }
});
