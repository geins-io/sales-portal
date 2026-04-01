<script setup lang="ts">
import { ShoppingCart } from 'lucide-vue-next';
import type { CartItemType } from '#shared/types/commerce';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';

const { t } = useI18n();

const props = defineProps<{
  items: CartItemType[];
}>();

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
</script>

<template>
  <Card v-if="props.items.length" data-testid="checkout-cart-items">
    <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
      <ShoppingCart class="text-muted-foreground size-5" />
      <CardTitle class="text-lg">{{ t('checkout.cart_items') }}</CardTitle>
    </CardHeader>
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
              <Icon
                name="lucide:image-off"
                class="text-muted-foreground size-5"
              />
            </div>
          </div>

          <!-- Info -->
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
          </div>

          <!-- Quantity -->
          <span class="text-muted-foreground shrink-0 text-sm">
            x {{ item.quantity ?? 0 }}
          </span>

          <!-- Line total -->
          <div class="shrink-0 text-right font-semibold whitespace-nowrap">
            <PriceDisplay
              v-if="item.totalPrice"
              :price="item.totalPrice"
              class="text-sm font-semibold"
            />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
