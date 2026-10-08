<script setup lang="ts">
/**
 * The price under a specification: net leads, VAT and the total support it,
 * as the prototype. Every amount arrives written, so the PDP's panel and a
 * configured line each say where theirs come from.
 */
const {
  prefix,
  size,
  quantity,
  net,
  rows,
  dimmed = false,
} = defineProps<{
  /** The test id prefix of the block, one per place it is shown. */
  prefix: string;
  size: 'summary' | 'foot' | 'sheet';
  quantity: number;
  net: string;
  /** VAT and the total, in that order. */
  rows: { label: string; amount: string }[];
  /** The net is being recomputed. */
  dimmed?: boolean;
}>();

const { t } = useI18n();

const netClass = {
  summary: 'text-xl',
  foot: 'text-base',
  sheet: 'text-xl',
} as const;
</script>

<template>
  <div
    class="flex items-baseline justify-between gap-3"
    :data-testid="`${prefix}-price-row`"
  >
    <span class="text-muted-foreground text-xs">
      {{ t('configurator.panel.net_price') }}
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
      class="font-semibold tabular-nums transition-opacity"
      :class="[netClass[size], dimmed ? 'opacity-40' : '']"
      :data-testid="`${prefix}-net`"
    >
      {{ net }}
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
