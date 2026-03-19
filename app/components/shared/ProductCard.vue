<script setup lang="ts">
import type { DetailProduct, ListProduct } from '#shared/types/commerce';
import { filterVisibleCampaigns } from '#shared/types/commerce';
import { stripGeinsPrefix } from '#shared/utils/menu';
import { BADGE_DESTRUCTIVE } from '~/lib/badge-styles';
import { ShoppingCart, Star, AlertCircle } from 'lucide-vue-next';
import { useCartStore } from '~/stores/cart';
import { useFavoritesStore } from '~/stores/favorites';

const props = withDefaults(
  defineProps<{
    product: DetailProduct | ListProduct;
    variant?: 'grid' | 'list';
  }>(),
  { variant: 'grid' },
);

const cartStore = useCartStore();
const favoritesStore = useFavoritesStore();
const { hasFeature } = useTenant();
const { canAccess } = useFeatureAccess();

const isFavorited = computed(() =>
  favoritesStore.isFavorite(props.product.alias),
);

function toggleFavorite() {
  favoritesStore.toggle(props.product.alias);
}

const showPrice = computed(() => {
  if (!hasFeature('pricing')) return true;
  return canAccess('pricing');
});

const firstImage = computed(() => props.product.productImages?.[0]);
const { localePath } = useLocaleMarket();
const productUrl = computed(() => {
  if (props.product.canonicalUrl) {
    return stripGeinsPrefix(props.product.canonicalUrl);
  }
  return localePath(`/${props.product.alias}`);
});

const firstSku = computed(() => props.product.skus?.[0] ?? null);

const maxQuantity = computed(() => {
  const stock = props.product.totalStock?.totalStock;
  return stock && stock > 0 ? stock : 99;
});

const visibleCampaigns = computed(() =>
  filterVisibleCampaigns(props.product.discountCampaigns ?? []),
);

const quantity = ref(1);
const isAdding = ref(false);
const addError = ref(false);

async function addToCart() {
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
}
</script>

<template>
  <!-- Grid variant -->
  <div
    v-if="variant === 'grid'"
    class="bg-card flex flex-col overflow-hidden rounded-md border"
    data-testid="product-card"
  >
    <!-- Image -->
    <div class="bg-muted group relative aspect-square w-full overflow-hidden">
      <NuxtLink :to="productUrl" class="block size-full">
        <GeinsImage
          v-if="firstImage?.fileName"
          :file-name="firstImage.fileName"
          type="product"
          :alt="product.name || ''"
          loading="lazy"
          class="size-full object-cover transition-transform group-hover:scale-105"
        />
      </NuxtLink>
      <!-- Campaign badges -->
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

    <!-- Content -->
    <div class="flex flex-1 flex-col gap-1 p-4">
      <!-- Article number + Wishlist -->
      <div class="flex items-center justify-between">
        <p
          v-if="product.articleNumber"
          class="text-muted-foreground text-xs"
          data-testid="article-number"
        >
          {{ $t('product.article_number', { number: product.articleNumber }) }}
        </p>
        <button
          v-if="hasFeature('wishlist')"
          type="button"
          data-testid="wishlist-button"
          :data-favorited="isFavorited"
          class="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          :aria-label="$t('product.wishlist')"
          @click.prevent.stop="toggleFavorite"
        >
          <Star class="size-4" :fill="isFavorited ? 'currentColor' : 'none'" />
        </button>
      </div>

      <!-- Product title -->
      <NuxtLink :to="productUrl" class="hover:underline">
        <h3 class="line-clamp-2 text-sm leading-tight font-medium">
          {{ product.name }}
        </h3>
      </NuxtLink>

      <!-- Brand name -->
      <p
        v-if="product.brand?.name"
        class="text-muted-foreground text-xs"
        data-testid="product-brand"
      >
        {{ product.brand.name }}
      </p>

      <!-- Stock badge -->
      <StockBadge
        v-if="product.totalStock"
        :stock="product.totalStock"
        size="sm"
      />

      <!-- Price -->
      <PriceDisplay
        v-if="product.unitPrice"
        :price="product.unitPrice"
        :lowest-price="product.lowestPrice"
        :discount-type="product.discountType"
        :campaign-names="visibleCampaigns.map((c) => c.name)"
        class="mt-1 text-base font-semibold"
      />

      <!-- Quantity + Add to cart (same row) -->
      <div v-if="showPrice" class="mt-auto flex items-center gap-2 pt-2">
        <QuantityInput
          v-model="quantity"
          :min="1"
          :max="maxQuantity"
          class="shrink-0"
        />
        <Button
          data-testid="add-to-cart-button"
          class="min-w-0 flex-1 overflow-hidden"
          size="sm"
          :variant="addError ? 'destructive' : 'default'"
          :disabled="!firstSku || isAdding"
          @click="addToCart"
        >
          <AlertCircle v-if="addError" class="mr-1.5 size-4 shrink-0" />
          <ShoppingCart v-else class="mr-1.5 size-4 shrink-0" />
          <span class="truncate">{{
            addError ? $t('cart.add_failed') : $t('cart.add_to_cart')
          }}</span>
        </Button>
      </div>
    </div>
  </div>

  <!-- List variant -->
  <div
    v-else
    class="bg-card flex flex-row items-center gap-4 overflow-hidden border-b"
    data-testid="product-card"
  >
    <!-- Thumbnail -->
    <div
      class="bg-muted group relative w-32 shrink-0 self-stretch overflow-hidden"
    >
      <NuxtLink :to="productUrl" class="block size-full">
        <GeinsImage
          v-if="firstImage?.fileName"
          :file-name="firstImage.fileName"
          type="product"
          :alt="product.name || ''"
          loading="lazy"
          class="size-full object-cover transition-transform group-hover:scale-105"
        />
      </NuxtLink>
      <!-- Campaign badges -->
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

    <!-- Info column -->
    <div class="flex min-w-0 flex-1 flex-col gap-0.5 py-3">
      <p
        v-if="product.articleNumber"
        class="text-muted-foreground text-xs"
        data-testid="article-number"
      >
        {{ $t('product.article_number', { number: product.articleNumber }) }}
      </p>
      <NuxtLink :to="productUrl" class="hover:underline">
        <h3 class="text-sm leading-tight font-medium">
          {{ product.name }}
        </h3>
      </NuxtLink>
      <StockBadge
        v-if="product.totalStock"
        :stock="product.totalStock"
        size="sm"
      />
    </div>

    <!-- Price + actions column -->
    <div class="flex shrink-0 items-center gap-3 pr-4">
      <PriceDisplay
        v-if="product.unitPrice"
        :price="product.unitPrice"
        :lowest-price="product.lowestPrice"
        :discount-type="product.discountType"
        :campaign-names="visibleCampaigns.map((c) => c.name)"
        class="text-base font-semibold"
      />
      <template v-if="showPrice">
        <QuantityInput v-model="quantity" :min="1" :max="maxQuantity" />
        <Button
          data-testid="add-to-cart-button"
          size="sm"
          :variant="addError ? 'destructive' : 'default'"
          :disabled="!firstSku || isAdding"
          @click="addToCart"
        >
          <AlertCircle v-if="addError" class="mr-1.5 size-4 shrink-0" />
          <ShoppingCart v-else class="mr-1.5 size-4 shrink-0" />
          <span class="whitespace-nowrap">{{
            addError ? $t('cart.add_failed') : $t('cart.add_to_cart')
          }}</span>
        </Button>
      </template>
    </div>
  </div>
</template>
