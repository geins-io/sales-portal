<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';
import type { CartItemType } from '#shared/types/commerce';

const { t } = useI18n();

const props = defineProps<{
  item: CartItemType;
}>();

const emit = defineEmits<{
  'update-quantity': [itemId: string, quantity: number];
  remove: [itemId: string];
}>();

function onQuantityUpdate(value: number) {
  if (!props.item.id) return;
  emit('update-quantity', props.item.id, value);
}

const productUrl = computed(() =>
  props.item.product?.canonicalUrl
    ? props.item.product.canonicalUrl
    : props.item.product?.alias
      ? `/product/${props.item.product.alias}`
      : null,
);

const imageFileName = computed(
  () => props.item.product?.productImages?.[0]?.fileName ?? '',
);

const skuName = computed(() => {
  if (!props.item.skuId || !props.item.product?.skus?.length) return '';
  const sku = props.item.product.skus.find(
    (s) => String(s.skuId) === String(props.item.skuId),
  );
  return sku?.name ?? '';
});

const maxQuantity = computed(() => {
  if (!props.item.skuId || !props.item.product?.skus?.length) return undefined;
  const sku = props.item.product.skus.find(
    (s) => String(s.skuId) === String(props.item.skuId),
  );
  const stock = sku?.stock?.totalStock;
  return stock && stock > 0 ? stock : undefined;
});
</script>

<template>
  <div class="space-y-2 py-4" data-testid="cart-item">
    <!-- Row 1: Thumbnail + product info + delete button -->
    <div class="flex items-start gap-4">
      <!-- Thumbnail -->
      <div class="size-16 shrink-0 overflow-hidden rounded-md">
        <GeinsImage
          v-if="imageFileName"
          :file-name="imageFileName"
          type="product"
          :alt="item.product?.name ?? ''"
          aspect-ratio="1"
          sizes="64px"
        />
        <div v-else class="bg-muted flex size-full items-center justify-center">
          <Icon name="lucide:image-off" class="text-muted-foreground size-5" />
        </div>
      </div>

      <!-- Info: name + article number -->
      <div class="min-w-0 flex-1">
        <NuxtLink
          v-if="productUrl"
          :to="productUrl"
          class="hover:text-primary text-sm font-medium"
          data-testid="cart-item-name"
        >
          {{ item.product?.name }}
        </NuxtLink>
        <span v-else class="text-sm font-medium" data-testid="cart-item-name">
          {{ item.product?.name ?? item.title ?? '' }}
        </span>
        <p
          v-if="item.product?.articleNumber || skuName"
          class="text-muted-foreground text-xs"
        >
          <template v-if="item.product?.articleNumber">
            Art nr. {{ item.product.articleNumber }}
          </template>
          <template v-if="skuName">
            <span v-if="item.product?.articleNumber"> &bull; </span>
            {{ skuName }}
          </template>
        </p>
      </div>

      <!-- Remove button -->
      <button
        type="button"
        class="text-muted-foreground hover:text-destructive shrink-0 p-1 transition-colors"
        data-testid="cart-item-remove"
        @click="item.id && emit('remove', item.id)"
      >
        <Trash2 class="size-4" />
      </button>
    </div>

    <!-- Row 2: Quantity + unit price + total price (aligned under product info) -->
    <div class="flex items-center gap-4 pl-20">
      <!-- Quantity -->
      <div class="shrink-0">
        <QuantityInput
          :model-value="item.quantity"
          :min="1"
          :max="maxQuantity"
          @update:model-value="onQuantityUpdate"
        />
      </div>

      <div class="flex-1" />

      <!-- Unit price with "à" prefix -->
      <div class="text-muted-foreground shrink-0 text-sm whitespace-nowrap">
        <span v-if="item.unitPrice">
          {{ t('cart.unit_price_prefix') }}
          <PriceDisplay :price="item.unitPrice" class="inline text-sm" />
        </span>
      </div>

      <!-- Total price -->
      <div class="shrink-0 text-right font-semibold whitespace-nowrap">
        <PriceDisplay
          v-if="item.totalPrice"
          :price="item.totalPrice"
          class="text-sm font-semibold"
        />
      </div>
    </div>
  </div>
</template>
