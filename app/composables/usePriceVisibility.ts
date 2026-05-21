export function usePriceVisibility() {
  const { isFeatureConfigured, hasFeature } = useTenant();
  const { canAccess } = useFeatureAccess();

  const showPrice = computed(() => {
    if (!isFeatureConfigured('priceVisibility')) return true;
    if (!hasFeature('priceVisibility')) return false;
    return canAccess('priceVisibility');
  });

  // True when the price is hidden but auth would unlock it — lets the UI
  // surface a "log in to see prices" hint. False when the tenant has the
  // feature outright disabled, because no user action will reveal them.
  const canUnlockByAuth = computed(() => {
    if (!isFeatureConfigured('priceVisibility')) return false;
    return hasFeature('priceVisibility') && !canAccess('priceVisibility');
  });

  return { showPrice, canUnlockByAuth };
}
