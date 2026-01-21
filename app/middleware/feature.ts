/**
 * Feature Flag Middleware
 *
 * Checks if a required feature is enabled for the current tenant.
 * Redirects to home if the feature is not available.
 *
 * @example
 * ```vue
 * <script setup>
 * definePageMeta({
 *   middleware: 'feature',
 *   feature: 'wishlist' // Required feature name
 * })
 * </script>
 * ```
 */
export default defineNuxtRouteMiddleware((to) => {
  const { hasFeature } = useTenant();

  // Get the required feature from route meta
  const requiredFeature = to.meta.feature as string | undefined;

  if (requiredFeature && !hasFeature(requiredFeature as never)) {
    // Feature not available for this tenant - only log in development
    if (import.meta.dev) {
      console.warn(
        `Feature "${requiredFeature}" is not enabled for this tenant`,
      );
    }
    return navigateTo('/');
  }
});
