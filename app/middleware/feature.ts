import type { FeatureName } from '#shared/types/tenant-config';

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

  // Get the required feature from route meta (typed via PageMeta augmentation)
  const requiredFeature = to.meta.feature as FeatureName | undefined;

  if (requiredFeature && !hasFeature(requiredFeature)) {
    // Feature not available for this tenant
    console.warn(`Feature "${requiredFeature}" is not enabled for this tenant`);
    return navigateTo('/');
  }
});
