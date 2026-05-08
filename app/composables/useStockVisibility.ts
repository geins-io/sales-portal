export function useStockVisibility() {
  const { hasFeature } = useTenant();
  const { canAccess } = useFeatureAccess();

  const showStock = computed(() => {
    if (!hasFeature('stockStatus')) return true;
    return canAccess('stockStatus');
  });

  return { showStock };
}
