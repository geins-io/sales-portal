import type { MaybeRefOrGetter } from 'vue';
import type { LatestProductOrder } from '#shared/types/commerce';
import { useAuthStore } from '~/stores/auth';

/**
 * The company's newest order holding a product, for the product page's
 * "latest ordered" row. Not fetched for a visitor who is not signed in.
 */
export function useLatestOrderForProduct(
  productId: MaybeRefOrGetter<number | null | undefined>,
) {
  const authStore = useAuthStore();
  const idRef = computed(() => toValue(productId) || 0);

  const { data, pending, error, refresh } = useFetch<{
    order: LatestProductOrder | null;
  }>(() => `/api/orders/products/by-id/${idRef.value}`, {
    immediate: authStore.isAuthenticated && idRef.value > 0,
    lazy: true,
    dedupe: 'defer',
  });

  const latestOrder = computed(() => data.value?.order ?? null);

  // Geins answers ISO timestamps; the row shows the date only.
  const formattedDate = computed(
    () => latestOrder.value?.createdAt.slice(0, 10) ?? '',
  );

  return { latestOrder, formattedDate, pending, error, refresh };
}
