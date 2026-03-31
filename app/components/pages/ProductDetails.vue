<script setup lang="ts">
import type {
  DetailProduct,
  ReviewsResponse,
  ListProduct,
} from '#shared/types/commerce';
import { filterVisibleCampaigns } from '#shared/types/commerce';
import { BADGE_DESTRUCTIVE } from '~/lib/badge-styles';
import { AlertTriangle as AlertTriangleIcon, Star } from 'lucide-vue-next';
import { useCartStore } from '~/stores/cart';
import { useFavoritesStore } from '~/stores/favorites';

const props = defineProps<{
  alias: string;
}>();

const slug = computed(() => props.alias);

const {
  data: product,
  error,
  status,
} = useFetch<DetailProduct>(() => `/api/products/${slug.value}`, {
  dedupe: 'defer',
});

const isLoading = computed(() => status.value === 'pending');

const { data: related } = useFetch<ListProduct[]>(
  () => `/api/products/${slug.value}/related`,
  { dedupe: 'defer', lazy: true },
);

const { data: reviewsData, execute: loadReviews } = useFetch<ReviewsResponse>(
  () => `/api/products/${slug.value}/reviews`,
  { dedupe: 'defer', immediate: false },
);

const reviews = computed<ReviewsResponse | null>(
  () => reviewsData.value ?? null,
);

const reviewsLoading = ref(false);

async function onLoadReviews() {
  reviewsLoading.value = true;
  await loadReviews();
  reviewsLoading.value = false;
}

// Variant state
const selectedVariants = ref<Record<string, string>>({});

const resolvedSku = computed(() => {
  if (!product.value?.variantGroup?.variants?.length) {
    return product.value?.skus?.[0] ?? null;
  }
  const variant = product.value.variantGroup.variants.find((v) =>
    v.attributes?.every(
      (attr) =>
        selectedVariants.value[attr.attributeName] === attr.attributeValue,
    ),
  );
  if (!variant) return product.value.skus?.[0] ?? null;
  return product.value.skus?.find((s) => s.skuId === variant.variantId) ?? null;
});

const quantity = ref(1);

const maxQuantity = computed(() => {
  const stock = product.value?.totalStock?.totalStock;
  return stock && stock > 0 ? stock : 99;
});

const cartStore = useCartStore();
const favoritesStore = useFavoritesStore();
const { hasFeature } = useTenant();
const { localePath } = useLocaleMarket();
const { canAccess } = useFeatureAccess();

const isFavorited = computed(() =>
  product.value ? favoritesStore.isFavorite(product.value.alias) : false,
);

function toggleFavorite() {
  if (product.value) {
    favoritesStore.toggle(product.value.alias);
  }
}

const showPrice = computed(() => {
  if (!hasFeature('pricing')) return true;
  return canAccess('pricing');
});

async function addToCart() {
  if (!resolvedSku.value?.skuId) return;
  await cartStore.addItem(resolvedSku.value.skuId, quantity.value);
}

// Discount campaigns
const visibleCampaigns = computed(() =>
  filterVisibleCampaigns(product.value?.discountCampaigns ?? []),
);

// Breadcrumbs
const { t } = useI18n();

const breadcrumbItems = computed(() => {
  const items: { label: string; href?: string }[] = [
    { label: t('common.home'), href: localePath('/') },
  ];

  // Extract category from the product's primaryCategory if available
  const category = product.value?.primaryCategory;
  if (category?.name) {
    items.push({ label: category.name });
  }

  if (product.value?.name) {
    items.push({ label: product.value.name });
  }

  return items;
});

// SEO
const plainDescription = computed(
  () =>
    product.value?.texts?.text1?.replace(/<[^>]*>/g, '').slice(0, 160) ?? '',
);

const primaryImageUrl = computed(
  () =>
    product.value?.productImages?.find((i) => i.isPrimary)?.url ??
    product.value?.productImages?.[0]?.url ??
    '',
);

useHead({
  title: () => product.value?.name ?? '',
});

useSeoMeta({
  description: () => plainDescription.value,
  ogTitle: () => product.value?.name ?? '',
  ogDescription: () => plainDescription.value,
  ogImage: () => primaryImageUrl.value || undefined,
});

// JSON-LD structured data (Schema.org Product + BreadcrumbList)
useSchemaOrg([
  defineProduct({
    name: () => product.value?.name ?? '',
    description: () => plainDescription.value,
    image: () =>
      product.value?.productImages?.map((img) => img.url).filter(Boolean) ?? [],
    brand: () =>
      product.value?.brand?.name
        ? { '@type': 'Brand', name: product.value.brand.name }
        : undefined,
    sku: () => resolvedSku.value?.skuId?.toString() ?? '',
    offers: () =>
      product.value?.unitPrice
        ? {
            '@type': 'Offer' as const,
            price: product.value.unitPrice.sellingPriceIncVat ?? 0,
            priceCurrency: product.value.unitPrice.currency?.code ?? 'SEK',
            availability: product.value.totalStock?.inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
          }
        : undefined,
    aggregateRating: () =>
      product.value?.rating?.reviewCount
        ? {
            '@type': 'AggregateRating' as const,
            ratingValue: product.value.rating.averageRating ?? 0,
            reviewCount: product.value.rating.reviewCount,
          }
        : undefined,
  }),
  defineBreadcrumb({
    itemListElement: () =>
      breadcrumbItems.value.map((bc, i) => ({
        '@type': 'ListItem' as const,
        position: i + 1,
        name: bc.label,
        item: bc.href,
      })),
  }),
]);
</script>

<template>
  <!-- Loading skeleton -->
  <ProductDetailsSkeleton
    v-if="isLoading && !product"
    data-testid="pdp-loading"
  />

  <!-- Error state -->
  <EmptyState
    v-else-if="error"
    :icon="AlertTriangleIcon"
    :title="$t('product.failed_to_load')"
    :description="$t('common.something_went_wrong')"
    action-label="Home"
    :action-to="localePath('/')"
    data-testid="pdp-error"
  />

  <div
    v-else-if="product"
    class="mx-auto max-w-7xl space-y-8 px-4 py-8 lg:px-8"
  >
    <!-- Breadcrumbs -->
    <AppBreadcrumbs v-if="breadcrumbItems.length" :items="breadcrumbItems" />

    <!-- Main content: two-column on md+ -->
    <div class="grid gap-8 md:grid-cols-2">
      <!-- Left: Gallery -->
      <ErrorBoundary section="product-gallery">
        <ProductGallery
          v-if="product.productImages?.length"
          :images="product.productImages"
          :product-name="product.name ?? ''"
        />
      </ErrorBoundary>

      <!-- Right: Product info -->
      <div class="flex flex-col gap-4">
        <!-- Product name + meta -->
        <div class="flex flex-col gap-1">
          <div class="flex items-start justify-between gap-2">
            <h1
              class="font-heading text-[20px] font-bold"
              data-testid="product-name"
            >
              {{ product.name }}
            </h1>
            <button
              v-if="hasFeature('wishlist')"
              type="button"
              class="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 transition-colors"
              :data-favorited="isFavorited"
              :aria-label="$t('product.wishlist')"
              data-testid="pdp-wishlist-toggle"
              @click="toggleFavorite"
            >
              <Star
                class="size-5"
                :fill="isFavorited ? 'currentColor' : 'none'"
              />
            </button>
          </div>

          <!-- Article number -->
          <p
            v-if="product.articleNumber"
            class="text-muted-foreground text-xs"
            data-testid="product-article-number"
          >
            Art nr. {{ product.articleNumber }}
          </p>

          <!-- Brand -->
          <p
            v-if="product.brand?.name"
            class="text-muted-foreground text-xs"
            data-testid="product-brand"
          >
            {{ product.brand.name }}
          </p>
        </div>

        <!-- Campaign badges -->
        <div
          v-if="visibleCampaigns.length"
          class="flex flex-wrap gap-1"
          data-testid="pdp-campaign-badges"
        >
          <span
            v-for="campaign in visibleCampaigns"
            :key="campaign.name"
            :class="BADGE_DESTRUCTIVE"
          >
            {{ campaign.name }}
          </span>
        </div>

        <!-- Price -->
        <PriceDisplay
          v-if="product.unitPrice"
          :price="product.unitPrice"
          :lowest-price="product.lowestPrice"
          :discount-type="product.discountType"
          :campaign-names="visibleCampaigns.map((c) => c.name)"
          class="text-base font-semibold"
        />

        <!-- Negotiated price info banner -->
        <div
          v-if="product.discountType === 'EXTERNAL'"
          class="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800"
          data-testid="negotiated-price-banner"
        >
          <Icon name="lucide:badge-check" class="size-4 shrink-0" />
          <span>{{ $t('discount.negotiated_price_info') }}</span>
        </div>

        <!-- Short description -->
        <p
          v-if="product.texts?.text2"
          class="text-muted-foreground text-sm leading-relaxed"
          data-testid="short-description"
        >
          {{ product.texts.text2 }}
        </p>

        <!-- Stock -->
        <StockBadge v-if="product.totalStock" :stock="product.totalStock" />

        <!-- Variant selector -->
        <VariantSelector
          v-if="product.variantDimensions?.length"
          v-model="selectedVariants"
          :variant-dimensions="product.variantDimensions"
          :variants="product.variantGroup?.variants ?? []"
        />

        <!-- Quantity + Add to cart -->
        <div v-if="showPrice" class="flex items-end gap-3">
          <QuantityInput v-model="quantity" :min="1" :max="maxQuantity" />
          <Button
            data-testid="add-to-cart-button"
            class="gap-2 px-6"
            @click="addToCart"
          >
            <Icon name="lucide:shopping-cart" class="size-4" />
            {{ $t('product.add_to_cart') }}
          </Button>
        </div>

        <!-- Download + Delivery links -->
        <div class="flex flex-col gap-2 pt-2">
          <a
            href="#"
            class="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
          >
            <Icon name="lucide:download" class="size-4" />
            <span>{{ $t('product.download') }}</span>
          </a>
          <a
            href="#"
            class="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
          >
            <Icon name="lucide:truck" class="size-4" />
            <span>{{ $t('product.delivery_info') }}</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Product tabs (full width) -->
    <ErrorBoundary section="product-tabs">
      <ProductTabs
        :product="product"
        :reviews="reviews"
        :reviews-loading="reviewsLoading"
        @load-reviews="onLoadReviews"
      />
    </ErrorBoundary>

    <!-- Related products -->
    <ErrorBoundary section="related-products">
      <RelatedProducts v-if="related?.length" :products="related" />
    </ErrorBoundary>
  </div>
</template>
