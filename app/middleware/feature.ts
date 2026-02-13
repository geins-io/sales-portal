import { logger } from '~/utils/logger';

/**
 * Feature Flag Middleware
 *
 * Checks if a required feature is accessible for the current user and tenant.
 * Evaluates both `.enabled` and `.access` rules (auth state, role, etc.).
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

  const { tenant, suspense } = useTenant();
  const { canAccess } = useFeatureAccess();

  // Ensure tenant data is loaded before checking features
  if (!tenant.value) {
    await suspense();
  }

  if (!canAccess(requiredFeature)) {
    logger.debug(
      `Feature "${requiredFeature}" is not accessible for this user/tenant`,
    );
    return navigateTo('/');
  }
});
