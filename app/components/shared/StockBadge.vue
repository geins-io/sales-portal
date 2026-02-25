<script setup lang="ts">
import type { StockType, StockStatus } from '#shared/types/commerce';
import { getStockStatus } from '#shared/types/commerce';

const props = withDefaults(
  defineProps<{
    stock?: StockType;
    threshold?: number;
    size?: 'default' | 'sm';
  }>(),
  { threshold: 5, size: 'default' },
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

const dotColor = computed(() => {
  switch (status.value) {
    case 'in-stock':
      return 'border-green-600';
    case 'low-stock':
      return 'border-amber-600';
    case 'out-of-stock':
      return 'border-red-600';
    case 'on-demand':
      return 'border-blue-600';
    default:
      return '';
  }
});
</script>

<template>
  <!-- Compact inline: green dot + text -->
  <span
    v-if="status && size === 'sm'"
    class="inline-flex items-center gap-1 text-xs"
  >
    <span
      class="size-[9px] shrink-0 rounded-full border-2 bg-transparent"
      :class="dotColor"
    />
    <span class="text-muted-foreground">{{ label }}</span>
  </span>

  <!-- Default: pill badge -->
  <Badge v-else-if="status" variant="outline" :class="badgeClass">
    {{ label }}
  </Badge>
</template>
