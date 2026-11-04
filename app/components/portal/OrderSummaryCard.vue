<script setup lang="ts">
import type { SummaryRow, SummaryRowKey } from '#shared/types/portal-rows';

/** An order's or a quotation's summary amounts in the grey card. */
const props = defineProps<{
  rows: SummaryRow[];
  /**
   * Off where the tenant hides prices. The caller decides: a quotation shows
   * its prices whatever the tenant's price visibility.
   */
  showPrices: boolean;
  /** "Order summary" by default. */
  title?: string;
}>();

defineSlots<{
  /** Beside the heading, e.g. a request's estimate badge. */
  'heading-aside'?: () => unknown;
  /** Under the rows, inside the card, e.g. a quotation's response buttons. */
  default?: () => unknown;
}>();

const { t } = useI18n();
const heading = computed(
  () => props.title ?? t('portal.orders.detail.summary.title'),
);

const ROW_CLASS: Partial<Record<SummaryRowKey, string>> = {
  discount: 'text-danger flex justify-between text-sm',
  total: 'border-border mt-2 flex justify-between border-t pt-4 font-semibold',
  'total-inc-vat': 'text-muted-foreground flex justify-between text-sm',
};
const PLAIN_LABEL = new Set<SummaryRowKey>([
  'discount',
  'total',
  'total-inc-vat',
]);
// An object, not `:class`: a bound class renders `class=""` where it has none.
const labelAttrs = (key: SummaryRowKey) =>
  PLAIN_LABEL.has(key) ? {} : { class: 'text-muted-foreground' };
</script>

<template>
  <div
    v-if="showPrices"
    data-testid="order-summary"
    class="bg-muted rounded-lg p-6"
  >
    <div
      v-if="$slots['heading-aside']"
      class="mb-4 flex items-baseline justify-between gap-3"
    >
      <h3 class="text-base font-semibold">{{ heading }}</h3>
      <slot name="heading-aside" />
    </div>
    <h3 v-else class="mb-4 text-base font-semibold">
      {{ heading }}
    </h3>
    <div class="space-y-3.5">
      <div
        v-for="row in rows"
        :key="row.key"
        :class="ROW_CLASS[row.key] ?? 'flex justify-between text-sm'"
        :data-testid="
          row.key === 'discount' ? 'order-summary-discount' : undefined
        "
      >
        <span v-bind="labelAttrs(row.key)">{{ row.label }}</span>
        <span v-if="row.key === 'discount'" class="font-medium">{{
          row.value
        }}</span>
        <span v-else :data-testid="`order-summary-${row.key}`">{{
          row.value
        }}</span>
      </div>
    </div>
    <div v-if="$slots.default" class="mt-4 space-y-4">
      <slot />
    </div>
  </div>
</template>
