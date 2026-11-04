<script setup lang="ts">
import type { Quote } from '#shared/types/quote';
import { quoteAmounts, quoteSummaryRows } from '~/utils/quote-view';

const props = defineProps<{
  quote: Quote;
  /** Shown in the shipping row while the quotation has no shipping. */
  shippingNote?: string;
}>();

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { showIncVat } = useVatDisplay();

const amounts = computed(() =>
  quoteAmounts(props.quote, showIncVat.value, formatLocale.value),
);

const summaryRows = computed(() =>
  quoteSummaryRows(
    amounts.value,
    props.quote.lineItems?.length ?? 0,
    showIncVat.value,
    t,
    props.shippingNote,
  ),
);
</script>

<template>
  <div data-testid="quote-summary">
    <p
      data-testid="quote-summary-lead-label"
      class="text-muted-foreground text-sm"
    >
      {{
        t(
          showIncVat
            ? 'portal.quotations.sum_inc_vat'
            : 'portal.quotations.sum_ex_vat',
        )
      }}
    </p>
    <p
      data-testid="quote-summary-subtotal"
      class="mt-1 text-3xl font-semibold tracking-tight tabular-nums"
    >
      {{ amounts.subtotal }}
    </p>
    <dl
      class="text-muted-foreground border-border mt-4 space-y-1 border-t pt-3 text-sm"
    >
      <div
        v-for="row in summaryRows"
        :key="row.key"
        :data-summary-row="row.key"
        :data-testid="row.key === 'shipping' ? 'shipping-row' : undefined"
        class="flex justify-between gap-4"
        :class="{
          'text-foreground font-semibold': row.emphasis,
          'text-danger': row.key === 'discount',
        }"
      >
        <dt>{{ row.label }}</dt>
        <dd :data-testid="`quote-summary-${row.key}`" class="tabular-nums">
          {{ row.value }}
        </dd>
      </div>
    </dl>
  </div>
</template>
