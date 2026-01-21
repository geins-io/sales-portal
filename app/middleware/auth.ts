import { useAuthStore } from '~/stores/auth';

/**
 * Authentication Middleware
 *
 * Protects routes that require authentication.
 * Redirects unauthenticated users to the login page.
 *
 * @example
 * ```vue
 * <script setup>
 * definePageMeta({
 *   middleware: 'auth'
 * })
 * </script>
 * ```
 */
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();

  // Initialize auth from storage if not already done (client-side only)
  if (import.meta.client && !authStore.token) {
    authStore.initializeFromStorage();
  }

  if (!authStore.isAuthenticated) {
    // Store the intended destination for redirect after login
    const redirectPath = to.fullPath;

    return navigateTo({
      path: '/login',
      query: redirectPath !== '/' ? { redirect: redirectPath } : undefined,
    });
  }
});
