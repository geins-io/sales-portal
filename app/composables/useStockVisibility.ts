export function useStockVisibility() {
  const { isFeatureConfigured, hasFeature } = useTenant();
  const { canAccess } = useFeatureAccess();

  const showStock = computed(() => {
    if (!isFeatureConfigured('stockStatus')) return true;
    if (!hasFeature('stockStatus')) return false;
    return canAccess('stockStatus');
  });

  return { showStock };
}
