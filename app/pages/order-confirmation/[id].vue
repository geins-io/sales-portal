<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const route = useRoute();

useHead({
  title: computed(() => t('order_confirmation.title')),
});

const orderId = computed(() => route.params.id as string);
const paymentMethod = computed(
  () => (route.query.paymentMethod as string) ?? 'invoice',
);

const { data, pending, error } = useFetch('/api/checkout/summary', {
  query: {
    orderId: orderId.value,
    paymentMethod: paymentMethod.value,
  },
  dedupe: 'defer',
});

const orderSummary = computed(() => data.value?.order ?? null);
const errorMessage = computed(() => {
  if (error.value) return t('order_confirmation.order_not_found');
  return null;
});
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <CheckoutOrderConfirmation
      :summary="orderSummary"
      :is-loading="pending"
      :error="errorMessage"
    />
  </div>
</template>
