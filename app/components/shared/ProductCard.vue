<script setup lang="ts">
import type { DetailProduct, ListProduct } from '#shared/types/commerce';
import { filterVisibleCampaigns } from '#shared/types/commerce';
import { productPath } from '#shared/utils/route-helpers';
import { BADGE_DESTRUCTIVE } from '~/lib/badge-styles';
import { ShoppingCart, Star, AlertCircle } from 'lucide-vue-next';
import { useCartStore } from '~/stores/cart';
import { useFavoritesStore } from '~/stores/favorites';

/**
 * Simplified product shape used by the new Figma-aligned ProductCard.
 * The component also accepts the full ListProduct | DetailProduct for
 * backward compatibility with existing callers (ProductList, RelatedProducts, etc.)
 * that have not yet been migrated to the simpler shape.
 */
export interface ProductCardItem {
  name: string;
  imageFileName?: string | null;
  price?: string | number | null;
  salePrice?: string | number | null;
  articleNumber?: string | null;
  alias?: string | null;
}

type ProductCardProp = ProductCardItem | ListProduct | DetailProduct;

const props = withDefaults(
  defineProps<{
    product: ProductCardProp;
    variant?: 'grid' | 'list';
    isLoading?: boolean;
  }>(),
  { variant: 'grid', isLoading: false },
);

const emit = defineEmits<{
  'add-to-cart': [payload: { quantity: number }];
}>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();

// Detect whether we're using the legacy rich product types
function isLegacyProduct(p: ProductCardProp): p is ListProduct | DetailProduct {
  return 'unitPrice' in p;
}

const cartStore = useCartStore();
const favoritesStore = useFavoritesStore();
const { hasFeature } = useTenant();
const { canAccess } = useFeatureAccess();

const productAlias = computed<string | null>(() => {
  if (isLegacyProduct(props.product)) return props.product.alias ?? null;
  return props.product.alias ?? null;
});

const isFavorited = computed(() => {
  if (!productAlias.value) return false;
  return favoritesStore.isFavorite(productAlias.value);
});

const showListPicker = ref(false);

function openListPicker() {
  if (!productAlias.value) return;
  showListPicker.value = true;
}

const showPrice = computed(() => {
  if (!isLegacyProduct(props.product)) return true;
  if (!hasFeature('pricing')) return true;
  return canAccess('pricing');
});

const firstImage = computed(() => {
  if (isLegacyProduct(props.product)) {
    return props.product.productImages?.[0];
  }
  return null;
});

const imageFileName = computed(() => {
  if (isLegacyProduct(props.product)) return firstImage.value?.fileName ?? null;
  return props.product.imageFileName ?? null;
});

const productUrl = computed(() => {
  if (isLegacyProduct(props.product)) {
    if (props.product.canonicalUrl) {
      return localePath(productPath(props.product.canonicalUrl));
    }
    return localePath(`/p/${props.product.alias}`);
  }
  if (props.product?.alias) {
    return localePath(`/p/${props.product.alias}`);
  }
  return null;
});

const firstSku = computed(() => {
  if (isLegacyProduct(props.product)) return props.product.skus?.[0] ?? null;
  return null;
});

const maxQuantity = computed(() => {
  if (isLegacyProduct(props.product)) {
    const stock = props.product.totalStock?.totalStock;
    return stock && stock > 0 ? stock : 99;
  }
  return undefined;
});

const visibleCampaigns = computed(() => {
  if (isLegacyProduct(props.product)) {
    return filterVisibleCampaigns(props.product.discountCampaigns ?? []);
  }
  return [];
});

const quantity = ref(1);
const isAdding = ref(false);
const addError = ref(false);

async function addToCart() {
  if (isLegacyProduct(props.product)) {
    if (!firstSku.value?.skuId) return;
    isAdding.value = true;
    addError.value = false;
    try {
      await cartStore.addItem(firstSku.value.skuId, quantity.value);
      if (cartStore.error) {
        addError.value = true;
      }
    } catch {
      addError.value = true;
    } finally {
      isAdding.value = false;
    }
  } else {
    emit('add-to-cart', { quantity: quantity.value });
  }
}
</script>

<template>
  <!-- Grid variant -->
  <div
    v-if="variant === 'grid'"
    class="bg-card flex flex-col overflow-hidden rounded-md border"
    data-testid="product-card"
  >
    <!-- Image (padded so it doesn't fill edge-to-edge) -->
    <div class="relative p-3">
      <div
        class="bg-muted group relative aspect-square w-full overflow-hidden rounded-md"
      >
        <NuxtLink v-if="productUrl" :to="productUrl" class="block size-full">
          <GeinsImage
            v-if="imageFileName"
            :file-name="imageFileName"
            type="product"
            :alt="product?.name ?? ''"
            loading="lazy"
            class="size-full object-contain transition-transform group-hover:scale-105"
          />
          <div
            v-else
            class="text-muted-foreground flex size-full items-center justify-center text-xs"
            data-testid="image-fallback"
          >
            {{ t('product.no_image') }}
          </div>
        </NuxtLink>
        <div v-else class="block size-full">
          <GeinsImage
            v-if="imageFileName"
            :file-name="imageFileName"
            type="product"
            :alt="product?.name ?? ''"
            loading="lazy"
            class="size-full object-contain transition-transform group-hover:scale-105"
          />
          <div
            v-else
            class="text-muted-foreground flex size-full items-center justify-center text-xs"
            data-testid="image-fallback"
          >
            {{ t('product.no_image') }}
          </div>
        </div>
        <!-- Campaign badges (legacy only) -->
        <div
          v-if="visibleCampaigns.length"
          class="absolute top-2 left-2 flex flex-col gap-1"
        >
          <span
            v-for="campaign in visibleCampaigns"
            :key="campaign.name"
            :class="BADGE_DESTRUCTIVE"
            data-testid="campaign-badge"
          >
            {{ campaign.name }}
          </span>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-1 flex-col gap-2 px-4 pb-4">
      <!-- Article number + Wishlist (Figma: heart sits next to art nr in
           the content area, not on the image) -->
      <div class="flex items-start justify-between gap-2">
        <p
          v-if="product?.articleNumber"
          class="text-muted-foreground text-xs"
          data-testid="article-number"
        >
          <template v-if="isLegacyProduct(product)">
            {{ t('product.article_number', { number: product.articleNumber }) }}
          </template>
          <template v-else>
            {{ product.articleNumber }}
          </template>
        </p>
        <span v-else />
        <Button
          v-if="productAlias && hasFeature('wishlist')"
          variant="ghost"
          size="icon-sm"
          data-testid="wishlist-button"
          :data-favorited="isFavorited"
          class="bg-card hover:bg-accent text-foreground -mt-1 shrink-0 rounded-md border shadow-sm"
          :aria-label="t('product.wishlist')"
          @click.prevent.stop="openListPicker"
        >
          <Star class="size-4" :fill="isFavorited ? 'currentColor' : 'none'" />
        </Button>
      </div>

      <!-- Product title (Figma: text-base/500) -->
      <NuxtLink v-if="productUrl" :to="productUrl" class="hover:underline">
        <h3 class="line-clamp-2 text-base leading-tight font-medium">
          {{ product?.name }}
        </h3>
      </NuxtLink>
      <h3 v-else class="line-clamp-2 text-base leading-tight font-medium">
        {{ product?.name }}
      </h3>

      <!-- Stock badge (legacy only) -->
      <StockBadge
        v-if="isLegacyProduct(product) && product.totalStock"
        :stock="product.totalStock"
        size="sm"
      />

      <!-- Price: legacy rich pricing -->
      <PriceDisplay
        v-if="isLegacyProduct(product) && product.unitPrice"
        :price="product.unitPrice"
        :lowest-price="product.lowestPrice"
        :discount-type="product.discountType"
        :campaign-names="visibleCampaigns.map((c) => c.name)"
        class="text-base font-semibold"
      />

      <!-- Price: simple ProductCardItem pricing -->
      <div
        v-else-if="!isLegacyProduct(product) && product.price != null"
        class="flex items-baseline gap-2"
      >
        <span
          v-if="product.salePrice != null"
          class="text-destructive text-sm font-semibold"
          data-testid="sale-price"
        >
          {{ product.salePrice }}
        </span>
        <span
          v-if="product.salePrice != null"
          class="text-muted-foreground text-xs line-through"
          data-testid="original-price"
        >
          {{ product.price }}
        </span>
        <span v-else class="text-sm font-semibold" data-testid="price">
          {{ product.price }}
        </span>
      </div>

      <!-- Quantity + Add to cart (Figma: both 36px tall, gap 12) -->
      <div v-if="showPrice" class="mt-auto flex items-center gap-3 pt-3">
        <!-- Legacy: QuantityInput -->
        <QuantityInput
          v-if="isLegacyProduct(product)"
          v-model="quantity"
          :min="1"
          :max="maxQuantity"
          class="h-9 shrink-0"
        />
        <!-- New: QuantityStepper -->
        <QuantityStepper
          v-else
          v-model="quantity"
          :min="1"
          class="h-9 shrink-0"
        />
        <Button
          data-testid="add-to-cart-button"
          class="h-9 min-w-0 flex-1 overflow-hidden px-4"
          :variant="addError ? 'destructive' : 'default'"
          :disabled="
            isLegacyProduct(product) ? !firstSku || isAdding : isLoading
          "
          @click="addToCart"
        >
          <AlertCircle
            v-if="isLegacyProduct(product) && addError"
            class="mr-1.5 size-4 shrink-0"
          />
          <ShoppingCart
            v-else-if="isLegacyProduct(product)"
            class="mr-1.5 size-4 shrink-0"
          />
          <span class="whitespace-nowrap">
            <template v-if="isLegacyProduct(product)">
              {{
                addError ? t('cart.add_failed') : t('cart.add_to_cart_short')
              }}
            </template>
            <template v-else>
              {{ t('common.add_to_cart') }}
            </template>
          </span>
        </Button>
      </div>
    </div>
    <AddToListDialog
      v-if="productAlias"
      v-model:open="showListPicker"
      :product-alias="productAlias"
    />
  </div>

  <!-- List variant (legacy only) — compact single-row layout per Figma -->
  <div
    v-else
    class="bg-card flex flex-row items-center gap-4 rounded-md border px-3 py-2"
    data-testid="product-card"
  >
    <!-- Thumbnail (small square) -->
    <div
      class="bg-muted relative aspect-square size-16 shrink-0 overflow-hidden rounded-md"
    >
      <NuxtLink v-if="productUrl" :to="productUrl" class="block size-full">
        <GeinsImage
          v-if="imageFileName"
          :file-name="imageFileName"
          type="product"
          :alt="product?.name ?? ''"
          loading="lazy"
          class="size-full object-contain"
        />
      </NuxtLink>
      <div v-else class="block size-full">
        <GeinsImage
          v-if="imageFileName"
          :file-name="imageFileName"
          type="product"
          :alt="product?.name ?? ''"
          loading="lazy"
          class="size-full object-contain"
        />
      </div>
      <div
        v-if="visibleCampaigns.length"
        class="absolute top-1 left-1 flex flex-col gap-0.5"
      >
        <span
          v-for="campaign in visibleCampaigns"
          :key="campaign.name"
          :class="BADGE_DESTRUCTIVE"
          data-testid="campaign-badge"
        >
          {{ campaign.name }}
        </span>
      </div>
    </div>

    <!-- Title + meta (single column, compact) -->
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <NuxtLink v-if="productUrl" :to="productUrl" class="hover:underline">
        <h3 class="line-clamp-1 text-sm leading-tight font-semibold">
          {{ product?.name }}
        </h3>
      </NuxtLink>
      <h3 v-else class="line-clamp-1 text-sm leading-tight font-semibold">
        {{ product?.name }}
      </h3>
      <p
        v-if="product?.articleNumber"
        class="text-muted-foreground text-xs"
        data-testid="article-number"
      >
        <template v-if="isLegacyProduct(product)">
          {{ t('product.article_number', { number: product.articleNumber }) }}
        </template>
        <template v-else>
          {{ product.articleNumber }}
        </template>
      </p>
      <StockBadge
        v-if="isLegacyProduct(product) && product.totalStock"
        :stock="product.totalStock"
        size="sm"
      />
    </div>

    <!-- Price -->
    <PriceDisplay
      v-if="isLegacyProduct(product) && product.unitPrice"
      :price="product.unitPrice"
      :lowest-price="product.lowestPrice"
      :discount-type="product.discountType"
      :campaign-names="visibleCampaigns.map((c) => c.name)"
      class="shrink-0 text-base font-semibold"
    />

    <!-- Actions: qty + cart + wishlist on a single row -->
    <template v-if="showPrice">
      <div class="flex shrink-0 items-center gap-2">
        <QuantityInput
          v-if="isLegacyProduct(product)"
          v-model="quantity"
          :min="1"
          :max="maxQuantity"
          class="h-9"
        />
        <QuantityStepper v-else v-model="quantity" :min="1" class="h-9" />
        <Button
          data-testid="add-to-cart-button"
          class="h-9 px-4"
          :variant="addError ? 'destructive' : 'default'"
          :disabled="
            isLegacyProduct(product) ? !firstSku || isAdding : isLoading
          "
          @click="addToCart"
        >
          <AlertCircle
            v-if="isLegacyProduct(product) && addError"
            class="mr-1.5 size-4 shrink-0"
          />
          <ShoppingCart
            v-else-if="isLegacyProduct(product)"
            class="mr-1.5 size-4 shrink-0"
          />
          <span class="whitespace-nowrap">
            <template v-if="isLegacyProduct(product)">
              {{ addError ? t('cart.add_failed') : t('cart.add_to_cart') }}
            </template>
            <template v-else>
              {{ t('common.add_to_cart') }}
            </template>
          </span>
        </Button>
        <Button
          v-if="productAlias && hasFeature('wishlist')"
          variant="ghost"
          size="icon-sm"
          data-testid="wishlist-button"
          :data-favorited="isFavorited"
          :aria-label="t('product.wishlist')"
          @click.prevent.stop="openListPicker"
        >
          <Star class="size-4" :fill="isFavorited ? 'currentColor' : 'none'" />
        </Button>
      </div>
    </template>

    <AddToListDialog
      v-if="productAlias"
      v-model:open="showListPicker"
      :product-alias="productAlias"
    />
  </div>
</template>
