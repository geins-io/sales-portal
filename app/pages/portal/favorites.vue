<script setup lang="ts">
import ProductCard, {
  type ProductCardItem,
} from '~/components/shared/ProductCard.vue';
import { useFavoritesStore } from '~/stores/favorites';
import { useCartStore } from '~/stores/cart';

definePageMeta({ middleware: ['auth', 'feature'], feature: 'wishlist' });

// Minimal product shape returned by /api/products/by-aliases. We only need
// the fields consumed by the card + add-to-cart handler.
interface FavoriteProduct {
  alias?: string | null;
  name?: string | null;
  articleNumber?: string | null;
  productImages?: Array<{ fileName?: string | null } | null> | null;
  unitPrice?: {
    isDiscounted?: boolean | null;
    regularPriceIncVat?: number | null;
    regularPriceIncVatFormatted?: string | null;
    sellingPriceIncVat?: number | null;
    sellingPriceIncVatFormatted?: string | null;
  } | null;
  skus?: Array<{ skuId?: number | null } | null> | null;
}

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const favoritesStore = useFavoritesStore();
const cartStore = useCartStore();

const viewMode = ref<'grid' | 'list'>('grid');

const aliasesQuery = computed(() => ({
  aliases: favoritesStore.items.join(','),
}));

const { data, pending, refresh } = useFetch<{ products: FavoriteProduct[] }>(
  '/api/products/by-aliases',
  {
    query: aliasesQuery,
    immediate: false,
    server: false,
    dedupe: 'defer',
  },
);

const products = computed<FavoriteProduct[]>(() => data.value?.products ?? []);

if (import.meta.client) {
  watch(
    () => favoritesStore.items,
    (items) => {
      if (items.length > 0) {
        refresh();
      }
    },
    { immediate: true },
  );
}

function mapToCardItem(product: FavoriteProduct): ProductCardItem {
  const unitPrice = product.unitPrice;
  const regular = unitPrice?.regularPriceIncVat ?? null;
  const selling = unitPrice?.sellingPriceIncVat ?? null;
  const hasDiscount =
    unitPrice?.isDiscounted === true ||
    (regular != null && selling != null && regular > selling);

  return {
    name: product.name ?? '',
    imageFileName: product.productImages?.[0]?.fileName ?? null,
    price: hasDiscount
      ? (unitPrice?.regularPriceIncVatFormatted ?? null)
      : (unitPrice?.sellingPriceIncVatFormatted ?? null),
    salePrice: hasDiscount
      ? (unitPrice?.sellingPriceIncVatFormatted ?? null)
      : null,
    articleNumber: product.articleNumber ?? null,
    alias: product.alias ?? null,
  };
}

async function handleAddToCart(
  product: FavoriteProduct,
  { quantity }: { quantity: number },
) {
  const firstSku = product.skus?.find((s) => s?.skuId != null);
  if (!firstSku?.skuId) return;
  await cartStore.addItem(firstSku.skuId, quantity);
}
</script>

<template>
  <PortalShell>
    <div data-testid="favorites-page">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-2xl font-bold">{{ t('portal.favorites.title') }}</h2>
        <div class="flex items-center gap-3">
          <span
            data-testid="favorites-count-text"
            class="text-muted-foreground text-sm"
          >
            {{ t('portal.favorites.count', { count: favoritesStore.count }) }}
          </span>
          <div data-testid="view-toggle" class="flex gap-1">
            <button
              type="button"
              :aria-label="t('portal.favorites.view_grid')"
              :aria-pressed="viewMode === 'grid'"
              :class="
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground rounded-md p-1.5'
                  : 'text-muted-foreground hover:bg-muted rounded-md p-1.5'
              "
              @click="viewMode = 'grid'"
            >
              <Icon name="lucide:grid-2x2" class="size-4" />
            </button>
            <button
              type="button"
              :aria-label="t('portal.favorites.view_list')"
              :aria-pressed="viewMode === 'list'"
              :class="
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground rounded-md p-1.5'
                  : 'text-muted-foreground hover:bg-muted rounded-md p-1.5'
              "
              @click="viewMode = 'list'"
            >
              <Icon name="lucide:list" class="size-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="favoritesStore.count === 0"
        data-testid="favorites-empty"
        class="mt-8 flex flex-col items-center gap-4 py-12 text-center"
      >
        <Icon name="lucide:heart" class="text-muted-foreground size-12" />
        <p class="text-muted-foreground">
          {{ t('portal.favorites.empty') }}
        </p>
        <NuxtLink
          :to="localePath('/products')"
          class="text-primary hover:text-primary/80 font-medium"
        >
          {{ t('portal.favorites.browse_products') }}
        </NuxtLink>
      </div>

      <!-- Loading state -->
      <div
        v-else-if="pending"
        data-testid="favorites-loading"
        class="text-muted-foreground py-12 text-center text-sm"
      >
        {{ t('portal.favorites.loading') }}
      </div>

      <!-- Product grid -->
      <div
        v-else
        data-testid="favorites-grid"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div
          v-for="product in products"
          :key="product.alias ?? ''"
          data-testid="favorite-card"
          class="relative"
        >
          <button
            type="button"
            data-testid="favorite-remove"
            :aria-label="t('portal.favorites.remove')"
            class="bg-background/80 hover:bg-background absolute top-2 right-2 z-10 rounded-full p-1.5 shadow"
            @click="product.alias && favoritesStore.remove(product.alias)"
          >
            <Icon
              name="lucide:heart"
              class="size-5 fill-red-500 text-red-500"
            />
          </button>
          <ProductCard
            :product="mapToCardItem(product)"
            :variant="viewMode"
            @add-to-cart="handleAddToCart(product, $event)"
          />
        </div>
      </div>
    </div>
  </PortalShell>
</template>
