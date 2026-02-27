import { useAuthStore } from '~/stores/auth';

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

  // On first load, check session via server (cookies are sent automatically)
  if (!authStore.isInitialized) {
    await authStore.fetchUser();
  }

  if (authStore.isAuthenticated) {
    const raw = (to.query.redirect as string) || '/';
    const redirect = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
    return navigateTo({ path: redirect });
  }
});
