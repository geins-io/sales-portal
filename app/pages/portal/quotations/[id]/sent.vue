<script setup lang="ts">
import type { Quote } from '#shared/types/quote';
import {
  quoteAmounts,
  quoteDiscountLabel,
  quoteRows,
} from '~/utils/quote-view';
import { summaryRows } from '~/utils/summary-rows';

definePageMeta({
  layout: 'checkout',
  middleware: ['auth', 'feature'],
  feature: 'quotes',
});

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { showIncVat } = useVatDisplay();
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
const { canRequestQuotes } = useFeatureAccess();
const isSent = computed(
  () => data.value?.quote.status === 'requested' && canRequestQuotes(),
);
if (!isSent.value) {
  await navigateTo(quotationPath.value, { replace: true });
}

const quote = computed(() => data.value!.quote);

// The order confirmation's parts, fed the request. Shipping is set in the
// quotation, so the row says so until the seller prices it.
const amounts = computed(() =>
  quoteAmounts(quote.value, showIncVat.value, formatLocale.value),
);
const lineRows = computed(() => quoteRows(quote.value, showIncVat.value));
const totals = computed(() =>
  summaryRows(
    amounts.value,
    quote.value.lineItems.length,
    showIncVat.value,
    t,
    {
      totalIncVatLabel: t('common.total_inc_vat'),
      discountLabel: quoteDiscountLabel(amounts.value, t),
      shippingNote: t('portal.quotations.request.shipping_note'),
    },
  ),
);

// What the buyer sent; nothing when every field is empty.
const sentDetails = computed(() => {
  const request = quote.value.request;
  return request && Object.values(request).some(Boolean) ? request : undefined;
});
const hasAddress = computed(
  () => !!(quote.value.billingAddress || quote.value.shippingAddress),
);

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
        <!-- Left: the lines (desktop only; below lg they are in the sheet) -->
        <div class="hidden min-w-0 lg:col-span-2 lg:block">
          <OrderItemsTable
            :items="lineRows"
            :rows="totals"
            show-prices
            :title="t('portal.quotations.confirm.request_lines')"
          />
        </div>

        <div class="space-y-6">
          <OrderSummaryCard
            :rows="totals"
            show-prices
            :title="t('portal.quotations.request.summary_title')"
          >
            <template #heading-aside>
              <QuoteEstimateBadge />
            </template>
          </OrderSummaryCard>
          <PortalItemRowsSheet
            class="lg:hidden"
            :items="lineRows"
            :totals="totals"
            :trigger-label="t('portal.quotations.view_items')"
            :title="t('portal.quotations.confirm.request_lines')"
            show-prices
          />
          <div
            v-if="hasAddress || sentDetails"
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
            <hr v-if="hasAddress && sentDetails" class="border-border" />
            <div
              v-if="sentDetails"
              data-testid="quote-thanks-request"
              class="space-y-1"
            >
              <p class="text-foreground font-semibold">
                {{ t('portal.orders.detail.additional_info.title') }}
              </p>
              <p
                v-if="sentDetails.customerOrderNumber"
                data-testid="quote-thanks-your-reference"
                class="text-muted-foreground wrap-break-word"
              >
                {{ t('portal.orders.detail.additional_info.your_reference') }}:
                {{ sentDetails.customerOrderNumber }}
              </p>
              <p
                v-if="sentDetails.desiredDeliveryDate"
                data-testid="quote-thanks-desired-date"
                class="text-muted-foreground"
              >
                {{
                  t(
                    'portal.orders.detail.additional_info.desired_delivery_date',
                  )
                }}:
                {{ sentDetails.desiredDeliveryDate }}
              </p>
              <p
                v-if="sentDetails.goodsLabel"
                data-testid="quote-thanks-goods-label"
                class="text-muted-foreground wrap-break-word"
              >
                {{ t('portal.orders.detail.additional_info.goods_label') }}:
                {{ sentDetails.goodsLabel }}
              </p>
              <p
                v-if="sentDetails.comment"
                data-testid="quote-thanks-comment"
                class="text-muted-foreground wrap-break-word whitespace-pre-line"
              >
                {{ t('portal.quotations.comment') }}: {{ sentDetails.comment }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </QuoteConfirmation>
  </div>
</template>
