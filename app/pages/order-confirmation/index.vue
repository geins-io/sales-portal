<script setup lang="ts">
import type { OrderDetailType } from '#shared/types/commerce';
import {
  orderPaymentLabel,
  orderToConfirmation,
} from '~/utils/order-confirmation';
import { paymentTypeLabelKey } from '~/utils/payment-type';

definePageMeta({ layout: 'checkout' });

const { t } = useI18n();
const route = useRoute();

useHead({
  title: computed(() => t('order_confirmation.title')),
});

function queryValue(name: string): string {
  const value = route.query[name];
  return typeof value === 'string' ? value : '';
}

// Two ways in:
// - Hosted checkout return: ?geins-cart=<cartId>&geins-pt=<PaymentType>, put
//   there by Geins.
// - In-app checkout:        ?orderId=<publicId>&orderNumber=<id>, put there by
//   checkout.vue.
const hostedCartId = queryValue('geins-cart');
const hostedPaymentType = queryValue('geins-pt');
const publicOrderId = hostedCartId ? '' : queryValue('orderId');
// Shown on the badge at once, before the order is readable.
const orderNumber = queryValue('orderNumber');

// In-app: the order the portal reads. Geins's checkout summary never carries
// an order placed through our own checkout, so it is not asked here.
const orderUrl = publicOrderId ? `/api/orders/${publicOrderId}` : null;
const { data: orderData, pending: orderPending } = useFetch<{
  order: OrderDetailType;
}>(`/api/orders/${publicOrderId}`, {
  dedupe: 'defer',
  immediate: !!orderUrl,
});
const order = computed(() => orderData.value?.order ?? null);

// The order is readable seconds after it was placed, so the page waits for it
// silently: the thank-you, number and link show at once, the rest fills in.
useAwaitedOrder<{ order: OrderDetailType }>({
  url: orderUrl,
  settled: () => !orderPending.value,
  hasOrder: () => !!order.value,
  onOrder: (fresh) => {
    orderData.value = fresh;
  },
});

// Hosted: the summary, with the payment type Geins put on the URL. Without
// one there is nothing valid to send, so nothing is asked.
const { data: hostedData, pending: hostedPending } = useFetch(
  '/api/checkout/summary',
  {
    query: { orderId: hostedCartId, paymentMethod: hostedPaymentType },
    dedupe: 'defer',
    immediate: !!(hostedCartId && hostedPaymentType),
  },
);

const summary = computed(() => {
  if (hostedCartId) return hostedData.value?.order ?? null;
  return order.value ? orderToConfirmation(order.value) : null;
});

const paymentLabel = computed(() => {
  if (!hostedCartId) {
    return order.value ? orderPaymentLabel(order.value) : undefined;
  }
  const key = paymentTypeLabelKey(hostedPaymentType);
  return key ? t(key) : undefined;
});
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-6">
    <OrderConfirmation
      :summary="summary"
      :is-loading="!!hostedCartId && hostedPending"
      :payment-label="paymentLabel"
      :reference="order?.customerOrderNumber"
      :order-number="orderNumber"
      :public-order-id="publicOrderId"
    />
  </div>
</template>
