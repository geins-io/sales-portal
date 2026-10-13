<script setup lang="ts">
import type { ConfigurationOption } from '#shared/types/configurator';
import { currencyCode, sideAmount } from '#shared/utils/configurator-price';
import { signedOptionPrice } from '~/utils/configurator-form';

/**
 * What an option adds to the configuration, as a row and the chooser row that
 * stands for it both show it: the price as sent, already net of any discount,
 * on the side of the buyer's VAT choice, with nothing struck through beside it. Nothing when it adds nothing or
 * prices are hidden. A span, because the chooser row is a button.
 */
const { option } = defineProps<{
  option: Pick<ConfigurationOption, 'unitPrice'>;
}>();

const { formatLocale } = useFormatLocale();
const { showPrice } = usePriceVisibility();
const { showIncVat } = useVatDisplay();

const price = computed(() =>
  signedOptionPrice(
    sideAmount(option.unitPrice, showIncVat.value),
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
