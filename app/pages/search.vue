<script setup lang="ts">
import type {
  ListProduct,
  ProductListResponse,
  ProductFiltersResponse,
} from '#shared/types/commerce';
import { useStorage } from '@vueuse/core';

const route = useRoute();
const router = useRouter();

// --- State ---
const searchTerm = computed(() => {
  const q = route.query.q;
  return typeof q === 'string' ? q : '';
});

const filterState = ref<Record<string, string[]>>({});
const sortBy = ref('relevance');
const viewMode = useStorage<'grid' | 'list'>('plp-view-mode', 'grid');
const skip = ref(0);
const take = 24;
const allProducts = ref<ListProduct[]>([]);

const sortOptions = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Newest', value: 'newest' },
  { label: 'Name: A-Z', value: 'name-asc' },
  { label: 'Name: Z-A', value: 'name-desc' },
];

// --- SEO ---
useHead({
  title: computed(() =>
    searchTerm.value ? `Search: ${searchTerm.value}` : 'Search',
  ),
});

// --- Data Fetching ---
const queryParams = computed(() => ({
  query: searchTerm.value,
  skip: skip.value,
  take,
  ...filterState.value,
}));

const { data: productsData, status: productsStatus } =
  useFetch<ProductListResponse>('/api/search/products', {
    query: queryParams,
    dedupe: 'defer',
  });

const { data: filtersData } = useFetch<ProductFiltersResponse>(
  '/api/product-lists/filters',
  {
    query: computed(() => ({
      filter: { searchText: searchTerm.value },
    })),
    dedupe: 'defer',
  },
);

// --- Derived ---
const facets = computed(() => filtersData.value?.filters ?? []);
const totalCount = computed(() => productsData.value?.count ?? 0);
const isLoading = computed(() => productsStatus.value === 'pending');
const hasMore = computed(() => allProducts.value.length < totalCount.value);

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

// --- Reset on search term or filter change ---
watch(
  [searchTerm, filterState],
  () => {
    skip.value = 0;
    allProducts.value = [];
  },
  { deep: true },
);

// --- URL sync for filters ---
watch(
  [filterState, sortBy],
  () => {
    const query: Record<string, string> = {};
    if (searchTerm.value) {
      query.q = searchTerm.value;
    }
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
  <div class="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
    <!-- Search header -->
    <div>
      <h1 class="text-2xl font-bold">
        {{
          searchTerm
            ? $t('search.results_for', { query: searchTerm })
            : $t('search.title')
        }}
      </h1>
      <p
        v-if="searchTerm && !isLoading"
        class="text-muted-foreground mt-1 text-sm"
      >
        {{ $t('search.result_count', { count: totalCount }) }}
      </p>
    </div>

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
            :product="product as any"
            :variant="viewMode"
          />
        </div>

        <!-- Empty state -->
        <div
          v-if="!isLoading && allProducts.length === 0 && searchTerm"
          class="py-12 text-center"
        >
          <Icon
            name="lucide:search-x"
            class="text-muted-foreground mx-auto mb-4 size-12"
          />
          <p class="text-muted-foreground text-lg">
            {{ $t('search.no_results_for', { query: searchTerm }) }}
          </p>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ $t('search.try_different_terms') }}
          </p>
        </div>

        <!-- No search term -->
        <div v-if="!searchTerm" class="py-12 text-center">
          <Icon
            name="lucide:search"
            class="text-muted-foreground mx-auto mb-4 size-12"
          />
          <p class="text-muted-foreground text-lg">
            {{ $t('search.enter_search_term') }}
          </p>
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
