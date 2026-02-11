import { logger } from '~/utils/logger';

/**
 * Feature Flag Middleware
 *
 * Checks if a required feature is enabled for the current tenant.
 * Redirects to home if the feature is not available.
 *
 * This middleware waits for tenant data to be loaded before checking
 * features to avoid race conditions during SSR or first load.
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
export default defineNuxtRouteMiddleware(async (to) => {
  const requiredFeature = to.meta.feature as string | undefined;

  if (!requiredFeature) {
    return;
  }

  const { hasFeature, tenant, suspense } = useTenant();

  // Ensure tenant data is loaded before checking features
  if (!tenant.value) {
    await suspense();
  }

  if (!hasFeature(requiredFeature)) {
    logger.debug(`Feature "${requiredFeature}" is not enabled for this tenant`);
    return navigateTo('/');
  }
});
