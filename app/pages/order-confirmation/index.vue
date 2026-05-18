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

// Summary is best-effort — Geins frequently hasn't propagated the order by
// the time the user lands here. The component shows a fallback thank-you
// when summary stays null, so we don't surface fetch errors to the user.
const { data, pending } = useFetch('/api/checkout/summary', {
  query: {
    orderId: orderId.value,
    paymentMethod: paymentMethod.value,
  },
  dedupe: 'defer',
  immediate: !!orderId.value,
});

const orderSummary = computed(() => data.value?.order ?? null);
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-6">
    <OrderConfirmation
      :summary="orderSummary"
      :is-loading="pending"
      :payment-method="paymentMethod"
    />
  </div>
</template>
