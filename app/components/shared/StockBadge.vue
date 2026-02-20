<script setup lang="ts">
import type { StockType, StockStatus } from '#shared/types/commerce';
import { getStockStatus } from '#shared/types/commerce';

const props = withDefaults(
  defineProps<{
    stock?: StockType;
    threshold?: number;
  }>(),
  { threshold: 5 },
);

const status = computed<StockStatus | null>(() => {
  if (!props.stock) return null;
  return getStockStatus(props.stock, props.threshold);
});

const label = computed(() => {
  switch (status.value) {
    case 'in-stock':
      return 'In stock';
    case 'low-stock':
      return 'Low stock';
    case 'out-of-stock':
      return 'Out of stock';
    case 'on-demand':
      return 'On demand';
    default:
      return '';
  }
});

const badgeClass = computed(() => {
  switch (status.value) {
    case 'in-stock':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'low-stock':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'out-of-stock':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'on-demand':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return '';
  }
});
</script>

<template>
  <Badge v-if="status" variant="outline" :class="badgeClass">
    {{ label }}
  </Badge>
</template>
