<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next';
import type { OrderDetailType } from '#shared/types/commerce';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';

definePageMeta({ layout: 'checkout' });

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();

useHead({
  title: computed(() => t('order_confirmation.title')),
});

function queryValue(name: string): string {
  const value = route.query[name];
  return typeof value === 'string' ? value : '';
}

// Two ways in:
// - In-app checkout:        ?orderId=<publicId>&orderNumber=<id>, put there by
//   checkout.vue. The order is read and shown.
// - Hosted checkout return: ?geins-cart=<cartId>. A hosted order returns with
//   nothing to read, so the page shows its thank-you header only.
const hosted = !!queryValue('geins-cart');
const publicOrderId = hosted ? '' : queryValue('orderId');
// Shown on the badge at once, before the order is readable.
const orderNumber = queryValue('orderNumber');

// The order the portal reads. Geins's checkout summary never carries an order
// placed through our own checkout, so it is not asked here.
const orderUrl = publicOrderId ? `/api/orders/${publicOrderId}` : null;
const { data: orderData, pending: orderPending } = useFetch<{
  order: OrderDetailType;
}>(`/api/orders/${publicOrderId}`, {
  dedupe: 'defer',
  immediate: !!orderUrl,
});
const order = computed(() => orderData.value?.order ?? null);

// The order is readable seconds after it was placed, so the page waits for it:
// the thank-you, number and link show at once, with a waiting indicator below
// until the rest fills in. At the bound it says the order is slow; the
// button above is the way on.
const gaveUp = ref(false);
useAwaitedOrder<{ order: OrderDetailType }>({
  url: orderUrl,
  settled: () => !orderPending.value,
  hasOrder: () => !!order.value,
  onOrder: (fresh) => {
    orderData.value = fresh;
  },
  onGiveUp: () => {
    gaveUp.value = true;
  },
});
const awaitingOrder = computed(
  () => !!orderUrl && !order.value && !gaveUp.value,
);

// A signed-out buyer has no portal to go on to, so at the bound the page
// offers one more read per click instead of the portal button.
const fetchingAgain = ref(false);
async function fetchAgain() {
  if (!orderUrl || fetchingAgain.value) return;
  fetchingAgain.value = true;
  try {
    orderData.value = await $fetch<{ order: OrderDetailType }>(orderUrl, {
      cache: 'no-store',
    });
  } catch {
    // Still not readable: the text and the button stay.
  } finally {
    fetchingAgain.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-6">
    <OrderConfirmation
      :order-number="orderNumber"
      :public-order-id="publicOrderId"
    >
      <div
        v-if="awaitingOrder || fetchingAgain"
        role="status"
        data-testid="confirmation-order-loading"
        class="text-muted-foreground mt-8 flex flex-col items-center gap-3 py-8"
      >
        <LoaderCircle class="size-8 animate-spin" aria-hidden="true" />
        <p class="text-sm">{{ t('common.fetching_order') }}</p>
      </div>
      <p
        v-else-if="gaveUp && !order && authStore.isAuthenticated"
        role="status"
        data-testid="confirmation-order-slow"
        class="text-muted-foreground mx-auto mt-8 max-w-3xl text-center text-sm"
      >
        {{ t('order_confirmation.order_slow') }}
      </p>
      <div
        v-else-if="gaveUp && !order"
        class="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-4 text-center"
      >
        <p
          role="status"
          data-testid="confirmation-order-slow-guest"
          class="text-muted-foreground text-sm"
        >
          {{ t('order_confirmation.order_slow_guest') }}
        </p>
        <Button
          type="button"
          variant="outline"
          data-testid="confirmation-fetch-again"
          @click="fetchAgain"
        >
          {{ t('order_confirmation.fetch_again') }}
        </Button>
      </div>
      <ConfirmedOrder
        v-if="order"
        :order="order"
        :public-order-id="publicOrderId"
      />
    </OrderConfirmation>
  </div>
</template>
