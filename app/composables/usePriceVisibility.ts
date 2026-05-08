export function usePriceVisibility() {
  const { isFeatureConfigured, hasFeature } = useTenant();
  const { canAccess } = useFeatureAccess();

  const showPrice = computed(() => {
    if (!isFeatureConfigured('priceVisibility')) return true;
    if (!hasFeature('priceVisibility')) return false;
    return canAccess('priceVisibility');
  });

  return { showPrice };
}
