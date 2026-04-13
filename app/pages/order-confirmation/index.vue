<script setup lang="ts">
definePageMeta({ layout: 'checkout' });

const { t } = useI18n();
const route = useRoute();

useHead({
  title: computed(() => t('order_confirmation.title')),
});

// Resolve the order id from either flow:
// - Hosted checkout return:  ?geins-cart=<cartid>  (Geins-substituted)
// - In-app checkout success: ?orderId=<publicId>   (set by checkout.vue)
const orderId = computed(
  () =>
    (route.query['geins-cart'] as string) ||
    (route.query.orderId as string) ||
    '',
);
const paymentMethod = computed(
  () => (route.query.paymentMethod as string) ?? 'invoice',
);

const { data, pending, error } = useFetch('/api/checkout/summary', {
  query: {
    orderId: orderId.value,
    paymentMethod: paymentMethod.value,
  },
  dedupe: 'defer',
  immediate: !!orderId.value,
});

const orderSummary = computed(() => data.value?.order ?? null);
const errorMessage = computed(() => {
  if (!orderId.value) return t('order_confirmation.order_not_found');
  if (error.value) return t('order_confirmation.order_not_found');
  return null;
});
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <OrderConfirmation
      :summary="orderSummary"
      :is-loading="pending"
      :error="errorMessage"
    />
  </div>
</template>
