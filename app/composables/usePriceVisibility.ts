export function usePriceVisibility() {
  const { hasFeature } = useTenant();
  const { canAccess } = useFeatureAccess();

  const showPrice = computed(() => {
    if (!hasFeature('priceVisibility')) return true;
    return canAccess('priceVisibility');
  });

  return { showPrice };
}
