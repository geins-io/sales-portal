<script setup lang="ts">
import type { StockType, StockStatus } from '#shared/types/commerce';
import { getStockStatus } from '#shared/types/commerce';

/** The one way stock reads: a dot and the status, both in the status tone. */
const props = withDefaults(
  defineProps<{
    stock?: StockType | null;
    /** A status worked out elsewhere; wins over `stock`. */
    status?: StockStatus | null;
    threshold?: number;
    size?: 'default' | 'sm';
  }>(),
  { stock: null, status: null, threshold: 5, size: 'default' },
);

const { t } = useI18n();
const { showStock } = useStockVisibility();

const current = computed<StockStatus | null>(() => {
  if (props.status) return props.status;
  return props.stock ? getStockStatus(props.stock, props.threshold) : null;
});

const LABELS: Record<StockStatus, string> = {
  'in-stock': 'product.in_stock',
  'low-stock': 'product.low_stock',
  'on-demand': 'product.on_demand',
  'out-of-stock': 'product.out_of_stock',
};

const TONES: Record<StockStatus, { dot: string; text: string }> = {
  'in-stock': { dot: 'bg-success', text: 'text-success' },
  'low-stock': { dot: 'bg-stock-low-dot', text: 'text-stock-low' },
  'on-demand': { dot: 'bg-info', text: 'text-info' },
  'out-of-stock': { dot: 'bg-stock-out-dot', text: 'text-stock-out' },
};
</script>

<template>
  <span
    v-if="showStock && current"
    class="inline-flex items-center font-medium whitespace-nowrap"
    :class="[
      TONES[current].text,
      size === 'sm' ? 'gap-1.5 text-xs' : 'gap-2 text-sm',
    ]"
    :data-stock-status="current"
  >
    <span
      class="shrink-0 rounded-full"
      :class="[TONES[current].dot, size === 'sm' ? 'size-2' : 'size-2.5']"
      aria-hidden="true"
    />
    {{ t(LABELS[current]) }}
  </span>
</template>
