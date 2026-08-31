import { logger } from '~/utils/logger';
import { useAuthStore } from '~/stores/auth';

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
  const authStore = useAuthStore();

  // Ensure tenant data is loaded before checking features
  if (!tenant.value) {
    await suspense();
  }

  // `access: 'authenticated'` reads the auth store, so an unresolved store
  // makes a signed-in user look anonymous. Mirrors middleware/auth.ts.
  if (!authStore.isInitialized) {
    await authStore.fetchUser();
  }

  if (!canAccess(requiredFeature)) {
    logger.debug(
      `Feature "${requiredFeature}" is not accessible for this user/tenant`,
    );
    // Build locale/market prefix from cookies (composables that depend
    // on useI18n/useRoute are unsafe inside middleware under SSR — see
    // app/middleware/auth.ts for the same workaround). Cookieless fallback:
    // tenant config default locale, then 'sv'.
    const market = useCookie('market').value || 'se';
    const locale =
      useCookie('locale').value || tenant.value?.locale?.split('-')[0] || 'sv';
    return navigateTo(`/${market}/${locale}/`, { replace: true });
  }
});
