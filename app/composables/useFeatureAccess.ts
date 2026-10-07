import { canAccessFeature, canConfigure } from '#shared/utils/feature-access';
import type { UserContext } from '#shared/utils/feature-access';
import { resolveProductPageType } from '~/utils/product-page-type';
import { useAuthStore } from '~/stores/auth';

/**
 * Composable for feature access control.
 * Combines tenant feature config with auth state to evaluate access rules.
 *
 * Separate from `useTenant()` because it depends on the auth store.
 * Use `hasFeature()` from `useTenant()` for simple "is it enabled" checks.
 */
export function useFeatureAccess() {
  const { features } = useTenant();
  const auth = useAuthStore();

  function user(): UserContext {
    return { authenticated: auth.isAuthenticated };
  }

  function canAccess(featureName: string): boolean {
    return canAccessFeature(features.value?.[featureName], user());
  }

  function configurator() {
    return features.value?.configurator;
  }

  return {
    canAccess,
    canConfigure: () => canConfigure(configurator(), user()),
    pageTypeOf: (product: { configurable?: boolean } | null | undefined) =>
      resolveProductPageType(product, configurator(), user()),
  };
}
