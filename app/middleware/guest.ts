import { useAuthStore } from '~/stores/auth';

/**
 * Guest Middleware
 *
 * Prevents authenticated users from accessing guest-only pages
 * like login and registration.
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
export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore();

  // On first load, check session via server (cookies are sent automatically)
  if (!authStore.isInitialized) {
    await authStore.fetchUser();
  }

  if (authStore.isAuthenticated) {
    // Redirect authenticated users to home or portal page
    return navigateTo('/portal');
  }
});
