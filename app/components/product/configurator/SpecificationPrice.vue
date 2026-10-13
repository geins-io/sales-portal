<script setup lang="ts">
/**
 * A specification's price block: the price on the side of the buyer's VAT
 * choice leads, the VAT rows support it. Every amount arrives written, so the
 * PDP's panel and a configured line each say where theirs come from.
 */
const {
  prefix,
  size,
  quantity,
  price,
  rows,
  dimmed = false,
} = defineProps<{
  /** The test id prefix of the block, one per place it is shown. */
  prefix: string;
  size: 'summary' | 'sheet';
  quantity: number;
  price: string;
  rows: { label: string; amount: string }[];
  /** The price is being recomputed. */
  dimmed?: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="flex items-baseline justify-between gap-3"
    :data-testid="`${prefix}-price-row`"
  >
    <span class="text-muted-foreground text-xs">
      {{ t('configurator.panel.price') }}
      <template v-if="quantity > 1">
        ·
        {{
          t('configurator.panel.quantity_suffix', {
            count: quantity,
          })
        }}
      </template>
    </span>
    <span
      class="text-xl font-semibold tabular-nums transition-opacity"
      :class="dimmed ? 'opacity-40' : ''"
      :data-testid="`${prefix}-net`"
    >
      {{ price }}
    </span>
  </div>
  <div
    v-for="(row, index) in rows"
    :key="index"
    class="text-muted-foreground flex justify-between gap-3"
    :class="[
      size === 'sheet' ? 'text-xs' : 'text-[11px]',
      index === 0 ? 'mt-1' : '',
    ]"
    :data-testid="`${prefix}-price-row`"
  >
    <span>{{ row.label }}</span>
    <span class="tabular-nums">{{ row.amount }}</span>
  </div>
</template>
