<script setup lang="ts">
import type {
  PriceType,
  LowestPriceInfo,
  ProductDiscountType,
} from '#shared/types/commerce';
import { formatPrice } from '#shared/types/commerce';

const props = withDefaults(
  defineProps<{
    price?: PriceType;
    showVat?: boolean;
    showDiscount?: boolean;
    fromPrice?: boolean;
    lowestPrice?: LowestPriceInfo;
    discountType?: ProductDiscountType;
    campaignNames?: string[];
  }>(),
  {
    showVat: true,
    showDiscount: true,
    fromPrice: false,
  },
);

const { t } = useI18n();

const { tenant, hasFeature } = useTenant();
const { canAccess } = useFeatureAccess();

const showPrice = computed(() => {
  if (!hasFeature('pricing')) return true;
  return canAccess('pricing');
});

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

const discountLabel = computed(() => {
  if (!isDiscounted.value) return '';
  switch (props.discountType) {
    case 'SALE_PRICE':
      return t('discount.sale');
    case 'PRICE_CAMPAIGN':
      return props.campaignNames?.[0] || t('discount.campaign');
    case 'EXTERNAL':
      return t('discount.your_price');
    default:
      return '';
  }
});

const discountLabelClass = computed(() => {
  if (props.discountType === 'EXTERNAL') {
    return 'bg-blue-100 text-blue-800 rounded-sm px-1.5 py-0.5 text-xs font-medium';
  }
  return 'bg-destructive/10 text-destructive rounded-sm px-1.5 py-0.5 text-xs font-medium';
});

const lowestPriceFormatted = computed(() => {
  if (!props.lowestPrice?.isDiscounted) return '';
  const formatted = props.showVat
    ? props.lowestPrice.lowestPriceIncVatFormatted
    : props.lowestPrice.lowestPriceExVatFormatted;
  if (formatted) return formatted;
  const raw = props.showVat
    ? props.lowestPrice.lowestPriceIncVat
    : props.lowestPrice.lowestPriceExVat;
  if (raw == null) return '';
  return formatPrice(raw, props.price?.currency?.code, tenant.value?.locale);
});
</script>

<template>
  <div v-if="price && !showPrice" class="inline-flex items-baseline">
    <span class="text-muted-foreground text-sm italic">
      {{ $t('product.login_for_prices') }}
    </span>
  </div>
  <div
    v-else-if="price && sellingPrice"
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
    <span
      v-if="discountLabel"
      :class="discountLabelClass"
      data-testid="discount-type-label"
    >
      {{ discountLabel }}
    </span>
    <span v-if="!showVat" class="text-muted-foreground text-xs">ex. VAT</span>
  </div>
  <div
    v-if="showPrice && lowestPriceFormatted"
    class="text-muted-foreground text-xs"
    data-testid="lowest-price"
  >
    {{ $t('product.lowest_price_30d', { price: lowestPriceFormatted }) }}
  </div>
</template>
