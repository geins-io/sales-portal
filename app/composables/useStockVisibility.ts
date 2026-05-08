export function useStockVisibility() {
  const { features, hasFeature } = useTenant();
  const { canAccess } = useFeatureAccess();

  const showStock = computed(() => {
    if (!features.value?.stockStatus) return true;
    if (!hasFeature('stockStatus')) return false;
    return canAccess('stockStatus');
  });

  return { showStock };
}
