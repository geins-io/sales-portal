import type { MaybeRefOrGetter } from 'vue';
import type { PurchasedProduct } from '#shared/types/commerce';
import { useAuthStore } from '~/stores/auth';

/**
 * Fetches the authenticated user's most recent order for a single
 * product alias.
 *
 * Geins's GraphQL has no per-product order-history filter (live
 * introspection confirms — `getOrders` only takes channel/lang/market).
 * Our server endpoint reuses the existing purchased-products
 * aggregator and returns the single matching row, so callers don't
 * have to pull and scan the full list.
 *
 * The fetch is lazy and skipped when the user is not authenticated,
 * which is the common case for an anonymous PDP visit.
 *
 * @example
 * const { latestOrder, formattedDate } = useLatestOrderForAlias(
 *   computed(() => product.value?.alias),
 * );
 */
export function useLatestOrderForAlias(
  alias: MaybeRefOrGetter<string | null | undefined>,
) {
  const authStore = useAuthStore();
  const aliasRef = computed(() => toValue(alias) || '');

  const { data, pending, error, refresh } = useFetch<{
    product: PurchasedProduct | null;
  }>(() => `/api/orders/products/by-alias/${aliasRef.value}`, {
    immediate: authStore.isAuthenticated && !!aliasRef.value,
    lazy: true,
    dedupe: 'defer',
    watch: [aliasRef],
  });

  const latestOrder = computed(() => data.value?.product ?? null);

  const formattedDate = computed(() => {
    const iso = latestOrder.value?.latestOrderDate;
    if (!iso) return '';
    // Geins returns ISO timestamps; show the date portion only.
    const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : iso.slice(0, 10);
  });

  return { latestOrder, formattedDate, pending, error, refresh };
}
