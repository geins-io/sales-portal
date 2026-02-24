<script setup lang="ts">
import type {
  ProductType,
  ReviewsResponse,
  ListProduct,
} from '#shared/types/commerce';
import type { ProductRouteResolution } from '#shared/types/common';

const props = defineProps<{
  resolution: ProductRouteResolution;
}>();

const slug = computed(() => props.resolution.productSlug ?? '');

const { data: product, error } = useFetch<ProductType>(
  () => `/api/products/${slug.value}`,
  { dedupe: 'defer' },
);

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
    v.attributes.every(
      (attr) =>
        selectedVariants.value[attr.attributeName] === attr.attributeValue,
    ),
  );
  if (!variant) return product.value.skus?.[0] ?? null;
  return product.value.skus?.find((s) => s.skuId === variant.variantId) ?? null;
});

const quantity = ref(1);

function addToCart() {
  console.log('Add to cart', {
    productId: product.value?.productId,
    skuId: resolvedSku.value?.skuId,
    quantity: quantity.value,
    selectedVariants: selectedVariants.value,
  });
}

// Breadcrumbs
const breadcrumbItems = computed(() => {
  if (!product.value?.breadcrumbs) return [];
  return product.value.breadcrumbs.map((bc) => ({
    label: bc.name,
    href: bc.url,
  }));
});

// SEO
useHead({
  title: () => product.value?.name ?? '',
});

useSeoMeta({
  description: () =>
    product.value?.texts?.text1?.replace(/<[^>]*>/g, '').slice(0, 160) ?? '',
  ogTitle: () => product.value?.name ?? '',
  ogDescription: () =>
    product.value?.texts?.text1?.replace(/<[^>]*>/g, '').slice(0, 160) ?? '',
});
</script>

<template>
  <div v-if="error" class="py-12 text-center">
    <p class="text-muted-foreground">Failed to load product.</p>
  </div>

  <div v-else-if="product" class="flex flex-col gap-8">
    <!-- Breadcrumbs -->
    <AppBreadcrumbs v-if="breadcrumbItems.length" :items="breadcrumbItems" />

    <!-- Main content: two-column on md+ -->
    <div class="grid gap-8 md:grid-cols-2">
      <!-- Left: Gallery -->
      <ProductGallery
        v-if="product.productImages?.length"
        :images="product.productImages"
        :product-name="product.name ?? ''"
      />

      <!-- Right: Product info -->
      <div class="flex flex-col gap-4">
        <!-- Brand -->
        <p
          v-if="product.brand?.name"
          class="text-muted-foreground text-sm"
          data-testid="product-brand"
        >
          {{ product.brand.name }}
        </p>

        <!-- Product name -->
        <h1 class="text-2xl font-bold" data-testid="product-name">
          {{ product.name }}
        </h1>

        <!-- Price -->
        <PriceDisplay
          v-if="product.unitPrice"
          :price="product.unitPrice"
          class="text-lg"
        />

        <!-- Stock -->
        <StockBadge v-if="product.totalStock" :stock="product.totalStock" />

        <!-- Variant selector -->
        <ProductVariantSelector
          v-if="product.variantDimensions?.length"
          v-model="selectedVariants"
          :variant-dimensions="product.variantDimensions"
          :variants="product.variantGroup?.variants ?? []"
        />

        <!-- Quantity + Add to cart -->
        <div class="flex items-center gap-3">
          <QuantityInput v-model="quantity" :min="1" :max="99" />
          <button
            type="button"
            class="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-md px-6 py-2.5 text-sm font-medium transition-colors"
            @click="addToCart"
          >
            Add to Cart
          </button>
        </div>

        <!-- Short description -->
        <p
          v-if="product.texts?.text2"
          class="text-muted-foreground text-sm"
          data-testid="short-description"
        >
          {{ product.texts.text2 }}
        </p>
      </div>
    </div>

    <!-- Product tabs (full width) -->
    <ProductTabs
      :product="product"
      :reviews="reviews"
      :reviews-loading="reviewsLoading"
      @load-reviews="onLoadReviews"
    />

    <!-- Related products -->
    <ProductRelatedProducts v-if="related?.length" :products="related" />
  </div>
</template>
