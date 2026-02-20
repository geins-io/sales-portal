<script setup lang="ts">
import type { PriceType } from '#shared/types/commerce';
import { formatPrice } from '#shared/types/commerce';

const props = withDefaults(
  defineProps<{
    price?: PriceType;
    showVat?: boolean;
    showDiscount?: boolean;
    fromPrice?: boolean;
  }>(),
  {
    showVat: true,
    showDiscount: true,
    fromPrice: false,
  },
);

const { tenant } = useTenant();

const sellingPrice = computed(() => {
  if (!props.price) return '';
  const formatted = props.showVat
    ? props.price.sellingPriceIncVatFormatted
    : props.price.sellingPriceExVatFormatted;
  if (formatted) return formatted;
  const raw = props.showVat
    ? props.price.sellingPriceIncVat
    : props.price.sellingPriceExVat;
  if (raw == null) return '';
  return formatPrice(raw, props.price.currency?.code, tenant.value?.locale);
});

const regularPrice = computed(() => {
  if (!props.price) return '';
  const formatted = props.showVat
    ? props.price.regularPriceIncVatFormatted
    : props.price.regularPriceExVatFormatted;
  if (formatted) return formatted;
  const raw = props.showVat
    ? props.price.regularPriceIncVat
    : props.price.regularPriceExVat;
  if (raw == null) return '';
  return formatPrice(raw, props.price.currency?.code, tenant.value?.locale);
});

const isDiscounted = computed(
  () => props.showDiscount && props.price?.isDiscounted,
);

const discountPercentage = computed(() => props.price?.discountPercentage ?? 0);
</script>

<template>
  <div
    v-if="price && sellingPrice"
    class="inline-flex flex-wrap items-baseline gap-2"
  >
    <span v-if="fromPrice" class="text-muted-foreground text-sm">From</span>
    <span class="font-semibold" :class="isDiscounted ? 'text-destructive' : ''">
      {{ sellingPrice }}
    </span>
    <span
      v-if="isDiscounted && regularPrice"
      class="text-muted-foreground text-sm line-through"
    >
      {{ regularPrice }}
    </span>
    <span
      v-if="isDiscounted && discountPercentage > 0"
      class="bg-destructive/10 text-destructive rounded-sm px-1.5 py-0.5 text-xs font-medium"
    >
      -{{ discountPercentage }}%
    </span>
    <span v-if="!showVat" class="text-muted-foreground text-xs">ex. VAT</span>
  </div>
</template>
