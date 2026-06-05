<script setup lang="ts">
import type { ListProduct } from '#shared/types/commerce';
import type { ContentConfigType } from '#shared/types/cms';

const props = defineProps<{
  data: {
    title?: string;
    searchParameters?: Record<string, unknown> | null;
    pageCount?: number;
  };
  config: ContentConfigType;
  layout: string;
}>();

const take = computed(() => (props.data.pageCount ?? 1) * 4);

// The CMS payload exposes the curated product selection as `searchParameters`
// which is the same shape Geins's `products(filter: FilterInputType)` query
// accepts (include/exclude/sort/searchText). Forward it verbatim as the
// `filter` query param so the widget renders exactly what the CMS configured
// instead of falling back to "first N products from the catalogue".
const filterParam = computed(() =>
  props.data.searchParameters &&
  Object.keys(props.data.searchParameters).length > 0
    ? JSON.stringify(props.data.searchParameters)
    : undefined,
);

// The product list resolves its language from the request context server-side,
// but the active locale/market must be part of the query so the fetch (and the
// CDN cache) is keyed per locale. Without it the widget reuses the previous
// locale's cached response and shows stale content after a language switch.
const { localeQuery } = useLocaleMarket();

const { data: productsData } = useFetch<{
  products: ListProduct[];
  count: number;
}>('/api/product-lists/products', {
  query: computed(() => ({
    take: take.value,
    skip: 0,
    ...(filterParam.value ? { filter: filterParam.value } : {}),
    ...localeQuery.value,
  })),
  dedupe: 'defer',
  lazy: true,
});

const products = computed(() => productsData.value?.products ?? []);
</script>

<template>
  <div v-if="data.title || products?.length" class="space-y-6">
    <div v-if="data.title" class="flex items-center justify-between">
      <h2 class="font-heading text-2xl font-bold">{{ data.title }}</h2>
    </div>
    <div
      v-if="products?.length"
      class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      <ProductCard
        v-for="product in products"
        :key="product.productId"
        :product="product"
        variant="grid"
      />
    </div>
  </div>
</template>
