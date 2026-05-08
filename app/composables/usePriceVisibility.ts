export function usePriceVisibility() {
  const { features, hasFeature } = useTenant();
  const { canAccess } = useFeatureAccess();

  const showPrice = computed(() => {
    if (!features.value?.priceVisibility) return true;
    if (!hasFeature('priceVisibility')) return false;
    return canAccess('priceVisibility');
  });

  return { showPrice };
}
