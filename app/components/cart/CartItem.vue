<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';
import type { CartItemType } from '#shared/types/commerce';

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
</script>

<template>
  <div class="flex gap-3 py-3" data-testid="cart-item">
    <!-- Thumbnail -->
    <div class="size-20 shrink-0 overflow-hidden rounded-md">
      <GeinsImage
        v-if="imageFileName"
        :file-name="imageFileName"
        type="product"
        :alt="item.product?.name ?? ''"
        aspect-ratio="1"
        sizes="80px"
      />
      <div v-else class="bg-muted flex size-full items-center justify-center">
        <Icon name="lucide:image-off" class="text-muted-foreground size-5" />
      </div>
    </div>

    <!-- Info -->
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <!-- Product name -->
      <NuxtLink
        v-if="productUrl"
        :to="productUrl"
        class="hover:text-primary truncate text-sm font-medium"
        data-testid="cart-item-name"
      >
        {{ item.product?.name }}
      </NuxtLink>
      <span
        v-else
        class="truncate text-sm font-medium"
        data-testid="cart-item-name"
      >
        {{ item.product?.name ?? item.title ?? '' }}
      </span>

      <!-- Brand -->
      <span
        v-if="item.product?.brand?.name"
        class="text-muted-foreground text-xs"
      >
        {{ item.product.brand.name }}
      </span>

      <!-- Campaign badge -->
      <span
        v-if="item.campaign?.appliedCampaigns?.[0]?.name"
        class="bg-destructive/10 text-destructive inline-flex w-fit rounded-sm px-1.5 py-0.5 text-xs font-medium"
      >
        {{ item.campaign.appliedCampaigns[0].name }}
      </span>

      <!-- Price -->
      <PriceDisplay
        v-if="item.unitPrice"
        :price="item.unitPrice"
        class="text-sm"
      />

      <!-- Quantity + Remove -->
      <div class="mt-1 flex items-center gap-2">
        <QuantityInput
          :model-value="item.quantity"
          :min="1"
          :max="99"
          @update:model-value="onQuantityUpdate"
        />
        <button
          type="button"
          class="text-muted-foreground hover:text-destructive p-1 transition-colors"
          data-testid="cart-item-remove"
          @click="item.id && emit('remove', item.id)"
        >
          <Trash2 class="size-4" />
        </button>
      </div>
    </div>

    <!-- Total price (right side) -->
    <div class="shrink-0 text-right">
      <PriceDisplay
        v-if="item.totalPrice"
        :price="item.totalPrice"
        class="text-sm font-medium"
      />
    </div>
  </div>
</template>
