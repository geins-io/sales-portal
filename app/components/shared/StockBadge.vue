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

// `bg-x/10 text-x` is the tinted-state pattern already used for `destructive`
// and by the configurator components. `on-demand` stays on literals: it is an
// informational state and there is no token for it — see the note in
// tailwind.css about the three states the tenant theme carries.
const badgeClass = computed(() => {
  switch (status.value) {
    case 'in-stock':
      return 'bg-success/10 text-success border-success/20';
    case 'low-stock':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'out-of-stock':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'on-demand':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return '';
  }
});

const dotColor = computed(() => {
  switch (status.value) {
    case 'in-stock':
      return 'border-success';
    case 'low-stock':
      return 'border-warning';
    case 'out-of-stock':
      return 'border-destructive';
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
  <Badge v-else-if="showStock && status" variant="outline" :class="badgeClass">
    {{ label }}
  </Badge>
</template>
