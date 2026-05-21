<script setup lang="ts">
/**
 * All Products Page
 *
 * Matches: /{market}/{locale}/products
 * Renders every product in the catalogue with no category/brand filter.
 * Supports pagination, sorting, and facet filters using the same
 * /api/product-lists/products endpoint as the category and brand PLPs.
 *
 * CMS CTAs can link here to give users a full catalogue view.
 * See docs/patterns/cms-config.md for how to wire CMS slots.
 */
import type {
  ProductListResponse,
  ProductFiltersResponse,
} from '#shared/types/commerce';
import { buildFilterInput, SORT_MAP } from '#shared/utils/filters';

const route = useRoute();
const router = useRouter();

// --- State ---
const reservedParams = new Set(['page', 'sort']);

function restoreFiltersFromQuery(): Record<string, string[]> {
  const state: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(route.query ?? {})) {
    if (reservedParams.has(key) || typeof value !== 'string') continue;
    const values = value.split(',').filter(Boolean);
    if (values.length > 0) state[key] = values;
  }
  return state;
}

const filterState = ref<Record<string, string[]>>(restoreFiltersFromQuery());
const sortBy = ref(
  typeof route.query.sort === 'string' ? route.query.sort : 'relevance',
);
const viewMode = useCookie<'grid' | 'list'>('plp-view-mode', {
  default: () => 'grid',
});
const take = 24;
const currentPage = ref(Number(route.query.page) || 1);
const skip = computed(() => (currentPage.value - 1) * take);

const { t } = useI18n();
const { localeQuery, currentLocale, currentMarket } = useLocaleMarket();

const sortOptions = computed(() => [
  { label: t('product.sort_relevance'), value: 'relevance' },
  { label: t('product.sort_price_asc'), value: 'price-asc' },
  { label: t('product.sort_price_desc'), value: 'price-desc' },
  { label: t('product.sort_newest'), value: 'newest' },
  { label: t('product.sort_name_asc'), value: 'name-asc' },
  { label: t('product.sort_name_desc'), value: 'name-desc' },
]);

// --- Filter input ---
const filterInput = computed(() =>
  buildFilterInput(filterState.value, sortBy.value, undefined, SORT_MAP),
);

// --- Data ---
const queryParams = computed(() => ({
  skip: skip.value,
  take,
  ...(filterInput.value ? { filter: JSON.stringify(filterInput.value) } : {}),
  ...localeQuery.value,
}));

const { data: productsData, status: productsStatus } =
  useFetch<ProductListResponse>('/api/product-lists/products', {
    query: queryParams,
    dedupe: 'defer',
  });

const { data: filtersData } = useFetch<ProductFiltersResponse>(
  '/api/product-lists/filters',
  {
    query: localeQuery,
    dedupe: 'defer',
    lazy: true,
  },
);

// --- Derived ---
const facets = computed(() => filtersData.value?.filters?.facets ?? []);
const totalCount = computed(() => productsData.value?.count ?? 0);
const products = computed(() => productsData.value?.products ?? []);
const isLoading = computed(() => productsStatus.value === 'pending');
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalCount.value / take)),
);
const showingFrom = computed(() => (totalCount.value > 0 ? skip.value + 1 : 0));
const showingTo = computed(() => Math.min(skip.value + take, totalCount.value));

// Clamp page if URL overruns
watch([totalPages, currentPage], ([pages, page]) => {
  if (pages > 0 && page > pages) currentPage.value = 1;
});

// URL sync
watch(
  [filterState, sortBy, currentPage],
  () => {
    const query: Record<string, string> = {};
    for (const [key, values] of Object.entries(filterState.value ?? {})) {
      if (values.length > 0) query[key] = values.join(',');
    }
    if (sortBy.value !== 'relevance') query.sort = sortBy.value;
    if (currentPage.value > 1) query.page = String(currentPage.value);
    router.replace({ query });
  },
  { deep: true },
);

function onPageChange(page: number) {
  currentPage.value = page;
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' });
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

// --- SEO ---
const canonicalUrl = computed(
  () => `/${currentMarket.value}/${currentLocale.value}/products`,
);

useHead({ title: () => t('nav.products') });

useSeoMeta({
  ogUrl: () => canonicalUrl.value,
  ogTitle: () => t('nav.products'),
});
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6">
    <!-- Page header -->
    <div>
      <h1
        class="font-heading text-5xl leading-tight font-bold md:text-6xl"
        data-testid="all-products-heading"
      >
        {{ $t('nav.products') }}
      </h1>
      <p
        v-if="totalCount > 0"
        class="text-muted-foreground mt-2 text-sm"
        data-testid="result-count"
      >
        {{ $t('product.result_count', { count: totalCount }) }}
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

    <!-- Toolbar -->
    <ProductListToolbar
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
    <ProductListSkeleton
      v-if="isLoading && products.length === 0"
      :view-mode="viewMode"
      data-testid="all-products-loading"
    />

    <!-- Product grid/list -->
    <div
      v-else
      :class="
        viewMode === 'grid'
          ? 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'
          : 'flex flex-col gap-4'
      "
      data-testid="all-products-grid"
    >
      <ProductCard
        v-for="product in products"
        :key="product.productId"
        :product="product"
        :variant="viewMode"
      />
    </div>

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
  </div>
</template>
