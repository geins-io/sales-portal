import type { FeatureName } from '#shared/types/tenant-config';
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
  // Get the required feature from route meta (typed via PageMeta augmentation)
  const requiredFeature = to.meta.feature as FeatureName | undefined;

  // Skip feature check if no feature is required
  if (!requiredFeature) {
    return;
  }

  const { hasFeature, tenant, suspense } = useTenant();

  // Ensure tenant data is loaded before checking features
  // This prevents race conditions where hasFeature returns false
  // because the API call hasn't completed yet
  if (!tenant.value) {
    await suspense();
  }

  if (!hasFeature(requiredFeature)) {
    // Feature not available for this tenant (debug - silenced in production)
    logger.debug(`Feature "${requiredFeature}" is not enabled for this tenant`);
    return navigateTo('/');
  }
});
