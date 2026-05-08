/**
 * Composable for price visibility control.
 *
 * Fail-open: if features.pricing is absent, prices ARE shown.
 * When configured, access is evaluated via useFeatureAccess.
 */
export function usePriceVisibility() {
  const { hasFeature } = useTenant();
  const { canAccess } = useFeatureAccess();

  const showPrice = computed(() => {
    if (!hasFeature('pricing')) return true;
    return canAccess('pricing');
  });

  return { showPrice };
}
