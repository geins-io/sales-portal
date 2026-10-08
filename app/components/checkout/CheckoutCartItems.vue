<script setup lang="ts">
import { ImageOff, Loader2, ShoppingCart, Trash2 } from 'lucide-vue-next';
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

/** A change on its way holds the line's controls until it answers. */
function isUpdating(item: CartItemType): boolean {
  return item.id != null && cartStore.updatingItems.has(item.id);
}

function shownQuantity(item: CartItemType): number {
  return (
    (item.id != null ? cartStore.pendingQuantities.get(item.id) : undefined) ??
    item.quantity ??
    1
  );
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
  <Card
    v-if="props.items.length"
    data-testid="checkout-cart-items"
    class="gap-0"
  >
    <CheckoutCardHeader
      :icon="ShoppingCart"
      :title="t('checkout.cart_items')"
    />
    <CardContent class="px-6">
      <div class="divide-border divide-y">
        <div
          v-for="item in props.items"
          :key="item.id ?? ''"
          class="flex items-start gap-4 py-3"
          data-testid="checkout-cart-item"
        >
          <!-- Thumbnail -->
          <div class="size-16 shrink-0 overflow-hidden rounded-md">
            <GeinsImage
              v-if="getImageFileName(item)"
              :file-name="getImageFileName(item)"
              type="product"
              :alt="item.product?.name ?? ''"
              aspect-ratio="1"
              sizes="64px"
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
              v-if="item.configuration"
              class="text-muted-foreground text-xs"
              data-testid="checkout-cart-item-configured"
            >
              {{ t('cart.configured_product') }}
            </p>
            <p
              v-else-if="item.product?.articleNumber || getSkuName(item)"
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
            <div class="mt-4 flex items-center gap-2">
              <div
                class="bg-muted inline-flex rounded-md [&_button]:size-7 [&_span]:min-w-7"
              >
                <QuantityStepper
                  :model-value="shownQuantity(item)"
                  :min="1"
                  :disabled="!props.isEditable || isUpdating(item)"
                  data-testid="checkout-quantity-stepper"
                  @update:model-value="handleQuantityUpdate(item, $event)"
                />
              </div>
              <span
                v-if="isUpdating(item)"
                role="status"
                class="text-muted-foreground inline-flex"
                data-testid="checkout-cart-item-updating"
              >
                <Loader2 class="size-4 animate-spin" aria-hidden="true" />
                <span class="sr-only">{{ t('cart.quantity_updating') }}</span>
              </span>
            </div>
            <p
              v-if="item.id != null && cartStore.quantityFailed.has(item.id)"
              class="text-destructive mt-2 text-xs"
              data-testid="checkout-cart-item-quantity-error"
            >
              {{ t('cart.quantity_change_failed') }}
            </p>
            <div v-if="item.configuration" class="mt-3">
              <LineSpecification
                :id="`checkout-cart-item-configuration-${item.id}`"
                :product-name="item.product?.name ?? ''"
                :quantity="item.quantity ?? 1"
                :configuration="item.configuration"
                :unit-price="item.unitPrice"
                :total-price="item.totalPrice"
              />
            </div>
          </div>

          <!-- Trash and price: right column. Trash sits above the prices. -->
          <div class="shrink-0 text-right whitespace-nowrap">
            <Button
              v-if="props.isEditable"
              type="button"
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground hover:text-destructive mb-2 shrink-0"
              :aria-label="t('checkout.remove_item')"
              :disabled="isUpdating(item)"
              data-testid="checkout-remove-item"
              @click="handleRemove(item)"
            >
              <Trash2 class="size-4" />
            </Button>
            <PriceDisplay
              v-if="item.totalPrice"
              :price="item.totalPrice"
              :quantity="item.quantity"
              :show-vat="true"
              testid="checkout-line-total"
              class="text-base font-semibold"
            />
            <p
              v-if="item.unitPrice && !item.configuration"
              class="text-muted-foreground text-sm"
              data-testid="checkout-unit-price"
            >
              <PriceDisplay
                :price="item.unitPrice"
                :show-vat="true"
                class="inline text-sm [&_span]:font-normal"
              />
              {{ t('checkout.per_unit') }}
            </p>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
