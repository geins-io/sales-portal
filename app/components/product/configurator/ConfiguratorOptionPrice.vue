<script setup lang="ts">
import type { ConfigurationOption } from '#shared/types/configurator';
import { currencyCode, exVatAmount } from '#shared/utils/configurator-price';
import { signedOptionPrice } from '~/utils/configurator-form';

/**
 * What an option adds to the configuration, as a row and the chooser row that
 * stands for it both show it: the price as sent, already net of any discount,
 * with nothing struck through beside it. Nothing when it adds nothing or
 * prices are hidden. A span, because the chooser row is a button.
 */
const { option } = defineProps<{
  option: Pick<ConfigurationOption, 'unitPrice'>;
}>();

const { formatLocale } = useFormatLocale();
const { showPrice } = usePriceVisibility();

const price = computed(() =>
  signedOptionPrice(
    exVatAmount(option.unitPrice),
    currencyCode(option.unitPrice),
    formatLocale.value,
  ),
);
</script>

<template>
  <span
    v-if="showPrice && price"
    data-testid="configurator-option-price"
    class="text-muted-foreground text-sm tabular-nums"
  >
    {{ price }}
  </span>
</template>
