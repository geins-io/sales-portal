<script setup lang="ts">
/**
 * Search Results Page
 *
 * Matches: /{market}/{locale}/s/{query}
 * The query parameter contains the search term.
 *
 * This is the type-prefixed URL for search.
 * The old /search?q=... page is kept for backward compatibility
 * and redirects here.
 */
import { Search as SearchIcon, SearchX as SearchXIcon } from 'lucide-vue-next';
import type {
  ProductListResponse,
  ProductFiltersResponse,
} from '#shared/types/commerce';
import { buildFilterInput, SORT_MAP } from '#shared/utils/filters';

const route = useRoute();
const router = useRouter();

// --- State ---
const searchTerm = computed(() => {
  const q = route.params.query;
  return typeof q === 'string' ? decodeURIComponent(q) : '';
});

const filterState = ref<Record<string, string[]>>({});
const sortBy = ref('relevance');
const viewMode = useCookie<'grid' | 'list'>('plp-view-mode', {
  default: () => 'grid',
});
const currentPage = ref(Number(route.query.page) || 1);
const take = 24;

const { t } = useI18n();
const { currentLocale, currentMarket, localeQuery } = useLocaleMarket();
const sortOptions = computed(() => [
  { label: t('product.sort_relevance'), value: 'relevance' },
  { label: t('product.sort_price_asc'), value: 'price-asc' },
  { label: t('product.sort_price_desc'), value: 'price-desc' },
  { label: t('product.sort_newest'), value: 'newest' },
  { label: t('product.sort_name_asc'), value: 'name-asc' },
  { label: t('product.sort_name_desc'), value: 'name-desc' },
]);

// --- SEO ---
const searchUrl = computed(
  () =>
    `/${currentMarket.value}/${currentLocale.value}/s/${encodeURIComponent(searchTerm.value)}`,
);

useHead({
  title: computed(() =>
    searchTerm.value
      ? t('search.results_for', { query: searchTerm.value })
      : t('search.title'),
  ),
});

useSeoMeta({
  robots: 'noindex,follow',
  ogUrl: () => searchUrl.value,
});

// --- Build filter object for GraphQL FilterInputType ---
const filterInput = computed(() =>
  buildFilterInput(filterState.value, sortBy.value, undefined, SORT_MAP),
);

// --- Data Fetching ---
const skip = computed(() => (currentPage.value - 1) * take);

const queryParams = computed(() => ({
  query: searchTerm.value,
  skip: skip.value,
  take,
  ...(filterInput.value ? { filter: JSON.stringify(filterInput.value) } : {}),
  ...localeQuery.value,
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
      filter: JSON.stringify({ searchText: searchTerm.value }),
      ...localeQuery.value,
    })),
    dedupe: 'defer',
  },
);

// --- Derived ---
const facets = computed(() => filtersData.value?.filters?.facets ?? []);
const totalCount = computed(() => productsData.value?.count ?? 0);
const products = computed(() => productsData.value?.products ?? []);
const isLoading = computed(() => productsStatus.value === 'pending');
const totalPages = computed(() => Math.ceil(totalCount.value / take));
const showingFrom = computed(() => (totalCount.value > 0 ? skip.value + 1 : 0));
const showingTo = computed(() => Math.min(skip.value + take, totalCount.value));

// --- Reset page on search term or filter change ---
watch(
  [searchTerm, filterState],
  () => {
    currentPage.value = 1;
  },
  { deep: true },
);

// --- URL sync for filters ---
watch(
  [filterState, sortBy, currentPage],
  () => {
    const query: Record<string, string> = {};
    for (const [key, values] of Object.entries(filterState.value ?? {})) {
      if (values.length > 0) {
        query[key] = values.join(',');
      }
    }
    if (sortBy.value !== 'relevance') {
      query.sort = sortBy.value;
    }
    if (currentPage.value > 1) {
      query.page = String(currentPage.value);
    }
    router.replace({ query });
  },
  { deep: true },
);

// --- Actions ---
function onPageChange(page: number) {
  currentPage.value = page;
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
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
      v-if="facets.length > 0"
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
    >
      <template #filters>
        <ProductFilters
          v-if="facets.length"
          v-model="filterState"
          :facets="facets"
        />
      </template>
    </ProductListToolbar>

    <!-- Loading skeleton -->
    <SearchResultsSkeleton
      v-if="isLoading && products.length === 0"
      :view-mode="viewMode"
      data-testid="search-loading"
    />

    <!-- Product grid/list -->
    <div
      v-else
      :class="
        viewMode === 'grid'
          ? 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'
          : 'flex flex-col gap-4'
      "
    >
      <ProductCard
        v-for="product in products"
        :key="product.productId"
        :product="product"
        :variant="viewMode"
      />
    </div>

    <!-- No results -->
    <EmptyState
      v-if="!isLoading && products.length === 0 && searchTerm"
      :icon="SearchXIcon"
      :title="$t('search.no_results_for', { query: searchTerm })"
      :description="$t('search.try_different_terms')"
      data-testid="search-empty"
    />

    <!-- No search term -->
    <EmptyState
      v-if="!searchTerm"
      :icon="SearchIcon"
      :title="$t('search.enter_search_term')"
      data-testid="search-no-term"
    />

    <!-- Pagination -->
    <div v-if="totalCount > 0" class="mt-8 flex items-center justify-between">
      <p class="text-muted-foreground text-sm">
        {{
          $t('pagination.showing_range', {
            from: showingFrom,
            to: showingTo,
            total: totalCount,
          })
        }}
      </p>
      <NumberedPagination
        :current-page="currentPage"
        :total-pages="totalPages"
        @update:current-page="onPageChange"
      />
    </div>

    <!-- File/document search placeholder -->
    <SearchFilesPlaceholder v-if="searchTerm" />
  </div>
</template>
