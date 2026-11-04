<script setup lang="ts">
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

// Only right after the request was sent; otherwise the quotation itself.
const isSent = computed(() => data.value?.quote.status === 'requested');
if (!isSent.value) {
  await navigateTo(quotationPath.value, { replace: true });
}

const quote = computed(() => data.value!.quote);

useHead({
  title: computed(() => t('portal.quotations.confirm.request_title')),
});
</script>

<template>
  <div v-if="isSent" class="mx-auto max-w-7xl px-4 py-8 lg:px-6">
    <QuoteConfirmation
      kind="request"
      :number="quote.quoteNumber"
      :quotation-path="quotationPath"
    >
      <div
        data-testid="quote-thanks-contents"
        class="border-border mt-8 grid grid-cols-1 gap-6 rounded-lg border bg-white p-6 lg:grid-cols-3"
      >
        <div class="min-w-0 lg:col-span-2">
          <h3 class="mb-3 text-base font-semibold">
            {{ t('portal.quotations.confirm.request_lines') }}
          </h3>
          <PortalQuoteItems :items="quote.lineItems" />
        </div>

        <div class="space-y-6">
          <div
            class="bg-muted rounded-lg p-6"
            data-testid="quote-thanks-summary"
          >
            <div class="mb-4 flex items-baseline justify-between gap-3">
              <h3 class="text-base font-semibold">
                {{ t('portal.quotations.request.summary_title') }}
              </h3>
              <QuoteEstimateBadge />
            </div>
            <PortalQuoteSummary
              :quote="quote"
              :shipping-note="t('portal.quotations.request.shipping_note')"
            />
          </div>
          <div
            v-if="quote.billingAddress || quote.shippingAddress"
            data-testid="quote-thanks-addresses"
            class="bg-muted space-y-4 rounded-lg p-6 text-sm"
          >
            <AddressBlock
              v-if="quote.billingAddress"
              bare
              label-style="header"
              company-muted
              :label="t('portal.quotations.invoice_address')"
              :address="quote.billingAddress"
            />
            <hr
              v-if="quote.billingAddress && quote.shippingAddress"
              class="border-border"
            />
            <AddressBlock
              v-if="quote.shippingAddress"
              bare
              label-style="header"
              company-muted
              :label="t('portal.quotations.delivery_address')"
              :address="quote.shippingAddress"
            />
          </div>
        </div>
      </div>
    </QuoteConfirmation>
  </div>
</template>
