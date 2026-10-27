<script setup lang="ts">
import type { StockType, StockStatus } from '#shared/types/commerce';
import { getStockStatus } from '#shared/types/commerce';
import type { BadgeVariant } from '~/components/ui/badge';

const props = withDefaults(
  defineProps<{
    stock?: StockType;
    threshold?: number;
    size?: 'default' | 'sm';
  }>(),
  { threshold: 5, size: 'default' },
);

const { t } = useI18n();
const { showStock } = useStockVisibility();

const status = computed<StockStatus | null>(() => {
  if (!props.stock) return null;
  return getStockStatus(props.stock, props.threshold);
});

const label = computed(() => {
  switch (status.value) {
    case 'in-stock':
      return t('product.in_stock');
    case 'low-stock':
      return t('product.low_stock');
    case 'out-of-stock':
      return t('product.out_of_stock');
    case 'on-demand':
      return t('product.on_demand');
    default:
      return '';
  }
});

const variant = computed<BadgeVariant | undefined>(() => {
  switch (status.value) {
    case 'in-stock':
      return 'success';
    case 'low-stock':
      return 'warning';
    case 'out-of-stock':
      return 'destructive-soft';
    case 'on-demand':
      return 'info';
    default:
      return undefined;
  }
});

const dotColor = computed(() => {
  switch (status.value) {
    case 'in-stock':
      return 'border-success';
    case 'low-stock':
      return 'border-warning';
    case 'out-of-stock':
      return 'border-danger';
    case 'on-demand':
      return 'border-info';
    default:
      return '';
  }
});
</script>

<template>
  <!-- Compact inline: tone dot + text -->
  <span
    v-if="showStock && status && size === 'sm'"
    class="inline-flex items-center gap-1 text-xs"
  >
    <span
      class="size-[9px] shrink-0 rounded-full border-2 bg-transparent"
      :class="dotColor"
    />
    <span class="text-muted-foreground">{{ label }}</span>
  </span>

  <!-- Default: pill badge -->
  <Badge v-else-if="showStock && status" :variant="variant">
    {{ label }}
  </Badge>
</template>
