<script setup lang="ts">
import { Loader2, Pencil, Trash2 } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import type { CartItemType } from '#shared/types/commerce';
import { filterVisibleCampaigns } from '#shared/types/commerce';
import { productPath } from '#shared/utils/route-helpers';
import { BADGE_DESTRUCTIVE } from '~/lib/badge-styles';
import { useCartStore } from '~/stores/cart';
import { editLineHref } from '~/utils/configurator-edit';

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

const { localePath } = useLocaleMarket();
const { showPrice } = usePriceVisibility();
const { showIncVat } = useVatDisplay();
const productUrl = computed(() =>
  props.item.product?.canonicalUrl
    ? localePath(productPath(props.item.product.canonicalUrl))
    : props.item.product?.alias
      ? localePath(productPath(props.item.product.alias))
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

/** Set on a configured line, which shows what it was committed with instead of the article line. */
const configuration = computed(() => props.item.configuration);
const configurationId = computed(
  () => `cart-item-configuration-${props.item.id}`,
);

const cart = useCartStore();
/**
 * The product page editing this line. The canonical path, never the alias: the
 * page's redirect to its canonical drops the query, and with it the edit.
 */
const editUrl = computed(() => {
  const canonical = props.item.product?.canonicalUrl;
  if (!configuration.value || !canonical || !cart.cartId || !props.item.id) {
    return null;
  }
  return editLineHref(localePath(productPath(canonical)), {
    cartId: cart.cartId,
    itemId: props.item.id,
  });
});

/** A change on its way holds the line's controls until it answers. */
const updating = computed(
  () => !!props.item.id && cart.updatingItems.has(props.item.id),
);
const shownQuantity = computed(
  () =>
    (props.item.id ? cart.pendingQuantities.get(props.item.id) : undefined) ??
    props.item.quantity,
);
const quantityFailed = computed(
  () => !!props.item.id && cart.quantityFailed.has(props.item.id),
);

const visibleItemCampaigns = computed(() =>
  filterVisibleCampaigns(props.item.campaign?.appliedCampaigns ?? []),
);

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
  <div class="border-b py-5" data-testid="cart-item">
    <div class="flex gap-4">
      <ProductThumbnail
        :file-name="imageFileName"
        :alt="item.product?.name ?? ''"
        size="size-20"
        radius="rounded-md"
        icon-size="size-8"
        sizes="80px"
        class="border"
        data-testid="cart-item-image"
      />

      <div class="min-w-0 flex-1 space-y-3" data-testid="cart-item-info">
        <!-- Name, what the line is, and the way to remove it -->
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <NuxtLink
              v-if="productUrl && !configuration"
              :to="productUrl"
              class="hover:text-primary font-medium"
              data-testid="cart-item-name"
            >
              {{ item.product?.name }}
            </NuxtLink>
            <p v-else class="font-medium" data-testid="cart-item-name">
              {{ item.product?.name ?? item.title ?? '' }}
            </p>
            <p
              v-if="configuration"
              class="text-muted-foreground text-sm"
              data-testid="cart-item-configured"
            >
              {{ t('cart.configured_product') }}
            </p>
            <p
              v-else-if="item.product?.articleNumber || skuName"
              class="text-muted-foreground text-sm"
              data-testid="cart-item-article"
            >
              <template v-if="item.product?.articleNumber">
                Art nr. {{ item.product.articleNumber }}
              </template>
              <template v-if="skuName">
                <span v-if="item.product?.articleNumber"> &bull; </span>
                {{ skuName }}
              </template>
            </p>
            <div
              v-if="visibleItemCampaigns.length"
              class="mt-0.5 flex flex-wrap gap-1"
            >
              <span
                v-for="campaign in visibleItemCampaigns"
                :key="campaign.name"
                :class="BADGE_DESTRUCTIVE"
                data-testid="cart-item-campaign"
              >
                {{ campaign.name }}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-destructive -mt-1 -mr-2 shrink-0"
            data-testid="cart-item-remove"
            :disabled="updating"
            :aria-label="
              item.product?.name
                ? t('cart.remove_item_named', { name: item.product.name })
                : t('cart.remove_item')
            "
            @click="item.id && emit('remove', item.id)"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>

        <!-- Quantity on the left, the line's price on the right -->
        <div
          class="flex items-center justify-between gap-3"
          data-testid="cart-item-price-row"
        >
          <div class="flex shrink-0 items-center gap-2">
            <QuantityInput
              :model-value="shownQuantity"
              :min="1"
              :max="maxQuantity"
              :disabled="updating"
              @update:model-value="onQuantityUpdate"
            />
            <span
              v-if="updating"
              role="status"
              class="text-muted-foreground inline-flex"
              data-testid="cart-item-updating"
            >
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              <span class="sr-only">{{ t('cart.quantity_updating') }}</span>
            </span>
          </div>

          <div v-if="showPrice && item.totalPrice" class="min-w-0 text-right">
            <div>
              <PriceDisplay
                :price="item.totalPrice"
                :quantity="item.quantity"
                :vat-label="false"
                testid="cart-item-total-price"
                class="inline-block text-base font-semibold tabular-nums"
              />
              <span
                class="text-muted-foreground ml-1.5 text-xs"
                data-testid="cart-item-vat"
              >
                {{ showIncVat ? t('common.vat_incl') : t('common.vat_excl') }}
              </span>
            </div>
            <div
              v-if="item.unitPrice && !configuration"
              class="text-muted-foreground inline-flex items-baseline gap-1 text-sm"
            >
              <span>{{ t('cart.unit_price_prefix') }}</span>
              <PriceDisplay
                :price="item.unitPrice"
                :vat-label="false"
                testid="cart-item-unit-price"
                class="text-sm"
              />
            </div>
          </div>
        </div>

        <p
          v-if="quantityFailed"
          class="text-destructive text-xs"
          data-testid="cart-item-quantity-error"
        >
          {{ t('cart.quantity_change_failed') }}
        </p>

        <!-- What a configured line was committed with opens in a panel,
             beside the way back to the configurator. Checkout and the order
             rows have no way to edit. -->
        <div
          v-if="configuration"
          class="flex flex-wrap gap-2"
          data-testid="cart-item-configuration-actions"
        >
          <LineSpecification
            :id="configurationId"
            :product-name="item.product?.name ?? ''"
            :quantity="item.quantity ?? 1"
            :configuration="configuration"
            :unit-price="item.unitPrice"
            :total-price="item.totalPrice"
          />
          <Button
            v-if="editUrl"
            as-child
            variant="outline"
            size="sm"
            class="h-6 gap-1 px-2 text-[11px]"
            :class="{ 'pointer-events-none opacity-50': updating }"
          >
            <NuxtLink
              :to="editUrl"
              :aria-disabled="updating || undefined"
              :tabindex="updating ? -1 : undefined"
              data-testid="cart-item-edit"
              @click="cart.isOpen = false"
            >
              <Pencil class="size-3" />
              {{ t('cart.edit_configuration') }}
            </NuxtLink>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
