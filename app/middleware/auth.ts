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
  // TODO: Implement actual authentication check
  // This is a placeholder that should be replaced with real auth logic
  const isAuthenticated = false;

  if (!isAuthenticated) {
    // Store the intended destination for redirect after login
    const redirectPath = to.fullPath;

    return navigateTo({
      path: '/login',
      query: redirectPath !== '/' ? { redirect: redirectPath } : undefined,
    });
  }
});
