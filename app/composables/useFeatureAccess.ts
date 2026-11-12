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

  /**
   * Whether this buyer may make, change or send a quote request:
   * signed in, with `quotes` and `quoteRequests` both open to them. The server
   * asks the same with `assertQuoteRequestAccess`.
   */
  function canRequestQuotes(): boolean {
    return (
      auth.isAuthenticated && canAccess('quotes') && canAccess('quoteRequests')
    );
  }

  return {
    canAccess,
    canRequestQuotes,
    canConfigure: () => canConfigure(user()),
    pageTypeOf: (product: { configurable?: boolean } | null | undefined) =>
      resolveProductPageType(product, user()),
  };
}
