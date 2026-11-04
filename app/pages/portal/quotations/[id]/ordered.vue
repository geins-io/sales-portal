<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next';
import type { OrderDetailType } from '#shared/types/commerce';
import type { Quote } from '#shared/types/quote';

definePageMeta({
  layout: 'checkout',
  middleware: ['auth', 'feature'],
  feature: 'quotes',
});

const { t } = useI18n();
const route = useRoute();
const { localePath } = useLocaleMarket();

const quoteId = computed(() => route.params.id as string);
const quotationPath = computed(() =>
  localePath(`/portal/quotations/${quoteId.value}`),
);

const { data, error } = await useFetch<{ quote: Quote }>(
  () => `/api/quotes/${quoteId.value}`,
  { dedupe: 'defer' },
);

if (error.value || !data.value?.quote) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Quotation not found',
    fatal: true,
  });
}

// Only once it became an order; otherwise the quotation itself.
const orderNumber =
  data.value.quote.status === 'finalized'
    ? (data.value.quote.orderId ?? '')
    : '';
if (!orderNumber) {
  await navigateTo(quotationPath.value, { replace: true });
}

const quote = computed(() => data.value!.quote);

// The quotation knows its order by number only.
const orderUrl = orderNumber
  ? `/api/orders/by-number/${encodeURIComponent(orderNumber)}`
  : null;
const { data: orderData, pending: orderPending } = useFetch<{
  order: OrderDetailType;
}>(orderUrl ?? '', { dedupe: 'defer', immediate: !!orderUrl });
const order = computed(() => orderData.value?.order ?? null);

// Readable only seconds after it was placed, as on the order confirmation.
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

useHead({
  title: computed(() => t('portal.quotations.confirm.order_title')),
});
</script>

<template>
  <div v-if="orderNumber" class="mx-auto max-w-7xl px-4 py-8 lg:px-6">
    <QuoteConfirmation
      kind="order"
      :number="orderNumber"
      :quote-number="quote.quoteNumber"
      :quotation-path="quotationPath"
    >
      <div
        v-if="!order && !gaveUp"
        role="status"
        data-testid="confirmation-order-loading"
        class="text-muted-foreground mt-8 flex flex-col items-center gap-3 py-8"
      >
        <LoaderCircle class="size-8 animate-spin" aria-hidden="true" />
        <p class="text-sm">{{ t('common.fetching_order') }}</p>
      </div>
      <p
        v-else-if="!order"
        role="status"
        data-testid="confirmation-order-slow"
        class="text-muted-foreground mx-auto mt-8 max-w-3xl text-center text-sm"
      >
        {{ t('order_confirmation.order_slow') }}
      </p>
      <ConfirmedOrder
        v-if="order"
        :order="order"
        :public-order-id="order.publicId ?? ''"
        :payment-terms="quote.paymentTerms"
      />
    </QuoteConfirmation>
  </div>
</template>
