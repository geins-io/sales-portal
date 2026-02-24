<script setup lang="ts">
import type {
  CategoryRouteResolution,
  BreadcrumbItem,
} from '#shared/types/common';
import type {
  ListProduct,
  ListPageInfo,
  ProductListResponse,
  ProductFiltersResponse,
} from '#shared/types/commerce';
import { useStorage } from '@vueuse/core';

const props = defineProps<{
  resolution: CategoryRouteResolution;
}>();

const router = useRouter();

// --- State ---
const filterState = ref<Record<string, string[]>>({});
const sortBy = ref('relevance');
const viewMode = useStorage<'grid' | 'list'>('plp-view-mode', 'grid');
const skip = ref(0);
const take = 24;
const allProducts = ref<ListProduct[]>([]);

const { t } = useI18n();
const sortOptions = computed(() => [
  { label: t('product.sort_relevance'), value: 'relevance' },
  { label: t('product.sort_price_asc'), value: 'price-asc' },
  { label: t('product.sort_price_desc'), value: 'price-desc' },
  { label: t('product.sort_newest'), value: 'newest' },
  { label: t('product.sort_name_asc'), value: 'name-asc' },
  { label: t('product.sort_name_desc'), value: 'name-desc' },
]);

// --- Data Fetching ---
const queryParams = computed(() => ({
  categoryAlias: props.resolution.categorySlug,
  skip: skip.value,
  take,
  ...filterState.value,
}));

const { data: productsData, status: productsStatus } =
  useFetch<ProductListResponse>('/api/product-lists/products', {
    query: queryParams,
    dedupe: 'defer',
  });

const { data: filtersData } = useFetch<ProductFiltersResponse>(
  '/api/product-lists/filters',
  {
    query: computed(() => ({ categoryAlias: props.resolution.categorySlug })),
    dedupe: 'defer',
  },
);

const { data: pageInfo } = useFetch<ListPageInfo>(
  () => `/api/product-lists/category/${props.resolution.categorySlug}`,
  { dedupe: 'defer' },
);

// --- Derived ---
const facets = computed(() => filtersData.value?.filters ?? []);
const totalCount = computed(() => productsData.value?.count ?? 0);
const isLoading = computed(() => productsStatus.value === 'pending');
const hasMore = computed(() => allProducts.value.length < totalCount.value);

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
  if (pageInfo.value?.name) {
    items.push({ label: pageInfo.value.name, current: true });
  }
  return items;
});

// --- Watch: products data → accumulate or replace ---
watch(
  productsData,
  (data) => {
    if (!data?.products) return;
    if (skip.value === 0) {
      allProducts.value = data.products;
    } else {
      allProducts.value = [...allProducts.value, ...data.products];
    }
  },
  { immediate: true },
);

// --- Filter change → reset pagination ---
watch(
  filterState,
  () => {
    skip.value = 0;
    allProducts.value = [];
  },
  { deep: true },
);

// --- URL sync ---
watch(
  [filterState, sortBy],
  () => {
    const query: Record<string, string> = {};
    for (const [key, values] of Object.entries(filterState.value)) {
      if (values.length > 0) {
        query[key] = values.join(',');
      }
    }
    if (sortBy.value !== 'relevance') {
      query.sort = sortBy.value;
    }
    router.replace({ query });
  },
  { deep: true },
);

// --- Actions ---
function loadMore() {
  skip.value = allProducts.value.length;
}

function removeFilter(facetId: string, valueId: string) {
  const values = filterState.value[facetId];
  if (!values) return;
  const filtered = values.filter((v) => v !== valueId);
  if (filtered.length === 0) {
    const { [facetId]: _, ...rest } = filterState.value;
    filterState.value = rest;
  } else {
    filterState.value = { ...filterState.value, [facetId]: filtered };
  }
}

function clearAllFilters() {
  filterState.value = {};
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header: breadcrumbs, title, description, sub-categories -->
    <ProductListHeader
      :page-info="pageInfo ?? null"
      :breadcrumbs="breadcrumbs"
    />

    <!-- Active filters -->
    <ActiveFilters
      :filters="filterState"
      :facets="facets"
      @remove="removeFilter"
      @clear-all="clearAllFilters"
    />

    <!-- Toolbar: count, sort, view toggle -->
    <ProductListToolbar
      :result-count="totalCount"
      :sort-value="sortBy"
      :sort-options="sortOptions"
      :view-mode="viewMode"
      @update:sort-value="sortBy = $event"
      @update:view-mode="viewMode = $event"
    />

    <!-- Main content: filters sidebar + product grid -->
    <div class="flex gap-8">
      <!-- Filters -->
      <ProductFilters
        v-if="facets.length"
        v-model="filterState"
        :facets="facets"
      />

      <!-- Product grid/list -->
      <div class="flex-1">
        <div
          :class="
            viewMode === 'grid'
              ? 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'
              : 'flex flex-col gap-4'
          "
        >
          <ProductCard
            v-for="product in allProducts"
            :key="product.productId"
            :product="product"
            :variant="viewMode"
          />
        </div>

        <!-- Empty state -->
        <div
          v-if="!isLoading && allProducts.length === 0"
          class="py-12 text-center"
        >
          <p class="text-muted-foreground">{{ $t('product.no_products') }}</p>
        </div>

        <!-- Load more -->
        <LoadMoreButton
          :loading="isLoading"
          :has-more="hasMore"
          @load-more="loadMore"
        />
      </div>
    </div>
  </div>
</template>
