<script setup lang="ts">
import type { ConfigurationOption } from '#shared/types/configurator';
import {
  currencyCode,
  exVatAmount,
  regularExVatAmount,
} from '#shared/utils/configurator-price';
import { signedOptionPrice } from '~/utils/configurator-form';

/**
 * What an option adds to the configuration, as a row and the chooser row that
 * stands for it both show it. Nothing when it adds nothing or prices are
 * hidden. A span, because the chooser row is a button.
 */
const { option } = defineProps<{
  option: Pick<ConfigurationOption, 'unitPrice' | 'discountPercent'>;
}>();

const { formatLocale } = useFormatLocale();
const { showPrice } = usePriceVisibility();

function signed(net: number): string {
  return signedOptionPrice(
    net,
    currencyCode(option.unitPrice),
    formatLocale.value,
  );
}

/**
 * `unitPrice` arrives already discounted; the percentage beside it is
 * information, never arithmetic.
 */
const price = computed(() => signed(exVatAmount(option.unitPrice)));

/** The regular price, struck through beside a discounted one, as sent. */
const regularPrice = computed(() => {
  const regular = regularExVatAmount(option.unitPrice);
  return regular === null ? '' : signed(regular);
});
</script>

<template>
  <span
    v-if="showPrice && price"
    data-testid="configurator-option-price"
    class="text-muted-foreground flex items-center gap-1.5 text-sm tabular-nums"
  >
    <span
      v-if="regularPrice"
      data-testid="configurator-option-regular-price"
      class="text-xs line-through"
    >
      {{ regularPrice }}
    </span>
    {{ price }}
    <span
      v-if="option.discountPercent > 0"
      data-testid="configurator-option-discount"
      class="bg-primary/10 text-primary rounded-full px-1.5 text-[10px] font-medium"
    >
      −{{ option.discountPercent }}%
    </span>
  </span>
</template>
