<script setup lang="ts">
import type { ListProduct } from '#shared/types/commerce';
import type { ContentConfigType } from '#shared/types/cms';

const props = defineProps<{
  data: {
    title?: string;
    searchParameters?: {
      sort?: string;
      searchText?: string | null;
      include?: unknown[];
      exclude?: unknown[];
    };
    pageCount?: number;
  };
  config: ContentConfigType;
  layout: string;
}>();

const take = computed(() => (props.data.pageCount ?? 1) * 4);

const { data: productsData } = useFetch<{
  products: ListProduct[];
  count: number;
}>('/api/product-lists/products', {
  query: computed(() => ({
    take: take.value,
    skip: 0,
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
