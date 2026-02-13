import { canAccessFeature } from '#shared/utils/feature-access';
import type { UserContext } from '#shared/utils/feature-access';
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

  function canAccess(featureName: string): boolean {
    const user: UserContext = {
      authenticated: auth.isAuthenticated,
      customerType: auth.user?.customerType,
    };
    return canAccessFeature(features.value?.[featureName], user);
  }

  return { canAccess };
}
