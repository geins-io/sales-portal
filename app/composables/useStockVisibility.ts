/**
 * Composable for stock visibility control.
 *
 * Mirrors the usePriceVisibility pattern.
 * Fail-open: if features.stock is absent, stock IS shown.
 */
export function useStockVisibility() {
  const { hasFeature } = useTenant();
  const { canAccess } = useFeatureAccess();

  const showStock = computed(() => {
    if (!hasFeature('stock')) return true;
    return canAccess('stock');
  });

  return { showStock };
}
