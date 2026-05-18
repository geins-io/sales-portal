<script setup lang="ts">
import { ImageOff, ShoppingCart, Trash2 } from 'lucide-vue-next';
import type { CartItemType } from '#shared/types/commerce';
import { Card, CardContent } from '~/components/ui/card';
import CheckoutCardHeader from './CheckoutCardHeader.vue';
import { Button } from '~/components/ui/button';
import { useCartStore } from '~/stores/cart';

const { t } = useI18n();
const cartStore = useCartStore();

const props = withDefaults(
  defineProps<{
    items: CartItemType[];
    isEditable?: boolean;
  }>(),
  { isEditable: false },
);

function getImageFileName(item: CartItemType): string {
  return item.product?.productImages?.[0]?.fileName ?? '';
}

function getSkuName(item: CartItemType): string {
  if (!item.skuId || !item.product?.skus?.length) return '';
  const sku = item.product.skus.find(
    (s) => String(s.skuId) === String(item.skuId),
  );
  return sku?.name ?? '';
}

function handleQuantityUpdate(item: CartItemType, newQty: number) {
  if (item.id == null) return;
  cartStore.updateQuantity(item.id, newQty);
}

function handleRemove(item: CartItemType) {
  if (item.id == null) return;
  cartStore.removeItem(item.id);
}
</script>

<template>
  <Card v-if="props.items.length" data-testid="checkout-cart-items">
    <CheckoutCardHeader
      :icon="ShoppingCart"
      :title="t('checkout.cart_items')"
    />
    <CardContent class="px-6">
      <div class="divide-border divide-y">
        <div
          v-for="item in props.items"
          :key="item.id ?? ''"
          class="flex items-center gap-4 py-3"
          data-testid="checkout-cart-item"
        >
          <!-- Thumbnail -->
          <div class="size-12 shrink-0 overflow-hidden rounded-md">
            <GeinsImage
              v-if="getImageFileName(item)"
              :file-name="getImageFileName(item)"
              type="product"
              :alt="item.product?.name ?? ''"
              aspect-ratio="1"
              sizes="48px"
            />
            <div
              v-else
              class="bg-muted flex size-full items-center justify-center"
            >
              <ImageOff class="text-muted-foreground size-5" />
            </div>
          </div>

          <!-- Info: name, SKU, and quantity stepper stacked -->
          <div class="min-w-0 flex-1">
            <span class="text-sm font-medium">
              {{ item.product?.name ?? item.title ?? '' }}
            </span>
            <p
              v-if="item.product?.articleNumber || getSkuName(item)"
              class="text-muted-foreground text-xs"
            >
              <template v-if="item.product?.articleNumber">
                Art nr. {{ item.product.articleNumber }}
              </template>
              <template v-if="getSkuName(item)">
                <span v-if="item.product?.articleNumber"> &bull; </span>
                {{ getSkuName(item) }}
              </template>
            </p>
            <div class="mt-2">
              <QuantityStepper
                :model-value="item.quantity ?? 1"
                :min="1"
                :disabled="!props.isEditable"
                data-testid="checkout-quantity-stepper"
                @update:model-value="handleQuantityUpdate(item, $event)"
              />
            </div>
          </div>

          <!-- Price and trash: right column -->
          <div class="shrink-0 text-right whitespace-nowrap">
            <PriceDisplay
              v-if="item.totalPrice"
              :price="item.totalPrice"
              class="text-sm font-semibold"
            />
            <p
              v-if="item.unitPrice"
              class="text-muted-foreground text-xs"
              data-testid="checkout-unit-price"
            >
              <PriceDisplay :price="item.unitPrice" class="text-xs" />
              {{ t('checkout.per_unit') }}
            </p>
            <Button
              v-if="props.isEditable"
              type="button"
              variant="ghost"
              size="icon"
              :aria-label="t('checkout.remove_item')"
              data-testid="checkout-remove-item"
              @click="handleRemove(item)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
