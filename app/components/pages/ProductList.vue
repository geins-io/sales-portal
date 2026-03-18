<script setup lang="ts">
import type {
  CategoryRouteResolution,
  BrandRouteResolution,
  BreadcrumbItem,
} from '#shared/types/common';
import type {
  ListPageInfo,
  ProductListResponse,
  ProductFiltersResponse,
} from '#shared/types/commerce';
import { Package as PackageIcon } from 'lucide-vue-next';
import { useDebounceFn } from '@vueuse/core';

const props = defineProps<{
  resolution: CategoryRouteResolution | BrandRouteResolution;
}>();

const isBrand = computed(() => props.resolution.type === 'brand');
const listSlug = computed(() =>
  isBrand.value
    ? (props.resolution as BrandRouteResolution).brandSlug
    : (props.resolution as CategoryRouteResolution).categorySlug,
);

const route = useRoute();
const router = useRouter();

// --- State (restored from URL on mount) ---
const reservedParams = new Set(['page', 'sort', 'searchText']);

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
const filterText = ref('');
const debouncedFilterText = ref('');
const take = 24;

// --- Page from URL ---
const currentPage = ref(Number(route.query.page) || 1);
const skip = computed(() => (currentPage.value - 1) * take);

const { t } = useI18n();
const sortOptions = computed(() => [
  { label: t('product.sort_relevance'), value: 'relevance' },
  { label: t('product.sort_price_asc'), value: 'price-asc' },
  { label: t('product.sort_price_desc'), value: 'price-desc' },
  { label: t('product.sort_newest'), value: 'newest' },
  { label: t('product.sort_name_asc'), value: 'name-asc' },
  { label: t('product.sort_name_desc'), value: 'name-desc' },
]);

// --- Sort mapping (UI value → GraphQL SortType) ---
const sortMap: Record<string, string> = {
  relevance: 'RELEVANCE',
  'price-asc': 'PRICE',
  'price-desc': 'PRICE_DESC',
  newest: 'LATEST',
  'name-asc': 'ALPHABETICAL',
  'name-desc': 'ALPHABETICAL',
};

// --- Build filter object for GraphQL FilterInputType ---
const filterInput = computed(() => {
  const selectedFacetIds = Object.values(filterState.value ?? {}).flat();
  const filter: Record<string, unknown> = {};

  if (selectedFacetIds.length > 0) filter.facets = selectedFacetIds;
  if (debouncedFilterText.value) filter.searchText = debouncedFilterText.value;
  if (sortBy.value !== 'relevance')
    filter.sort = sortMap[sortBy.value] ?? 'RELEVANCE';

  return Object.keys(filter).length > 0 ? filter : undefined;
});

// --- Data Fetching ---
const queryParams = computed(() => ({
  ...(isBrand.value
    ? { brandAlias: listSlug.value }
    : { categoryAlias: listSlug.value }),
  skip: skip.value,
  take,
  ...(filterInput.value ? { filter: filterInput.value } : {}),
}));

const { data: productsData, status: productsStatus } =
  useFetch<ProductListResponse>('/api/product-lists/products', {
    query: queryParams,
    dedupe: 'defer',
  });

const { data: filtersData } = useFetch<ProductFiltersResponse>(
  '/api/product-lists/filters',
  {
    query: computed(() =>
      isBrand.value
        ? { brandAlias: listSlug.value }
        : { categoryAlias: listSlug.value },
    ),
    dedupe: 'defer',
  },
);

const pageInfoUrl = computed(() =>
  isBrand.value
    ? `/api/product-lists/brand/${listSlug.value}`
    : `/api/product-lists/category/${listSlug.value}`,
);

const { data: pageInfo } = useFetch<ListPageInfo>(pageInfoUrl, {
  dedupe: 'defer',
});

// --- Derived ---
const facets = computed(() => filtersData.value?.filters?.facets ?? []);
const totalCount = computed(() => productsData.value?.count ?? 0);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalCount.value / take)),
);
const isLoading = computed(() => productsStatus.value === 'pending');
const products = computed(() => productsData.value?.products ?? []);

const showingFrom = computed(() =>
  totalCount.value === 0 ? 0 : skip.value + 1,
);
const showingTo = computed(() => Math.min(skip.value + take, totalCount.value));

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
  if (pageInfo.value?.name) {
    items.push({ label: pageInfo.value.name, current: true });
  }
  return items;
});

// --- SEO ---
useHead({
  title: () => pageInfo.value?.name ?? '',
});

useSeoMeta({
  description: () => pageInfo.value?.primaryDescription?.slice(0, 160) ?? '',
  ogTitle: () => pageInfo.value?.name ?? '',
  ogDescription: () => pageInfo.value?.primaryDescription?.slice(0, 160) ?? '',
});

// --- Filter change → reset pagination ---
watch(
  filterState,
  () => {
    currentPage.value = 1;
  },
  { deep: true },
);

// --- Filter text with debounce ---
const applyFilterText = useDebounceFn((value: string) => {
  debouncedFilterText.value = value;
  currentPage.value = 1;
}, 300);

watch(filterText, (value) => {
  applyFilterText(value);
});

// --- URL sync ---
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
  // Scroll to top of product grid (client-only — window is not available during SSR)
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
    <!-- Header: breadcrumbs, title, description, sub-categories -->
    <ProductListHeader
      :page-info="pageInfo ?? null"
      :breadcrumbs="breadcrumbs"
    />

    <!-- Active filters -->
    <ActiveFilters
      v-if="facets && facets.length > 0"
      :filters="filterState"
      :facets="facets"
      @remove="removeFilter"
      @clear-all="clearAllFilters"
    />

    <!-- Toolbar: filter, sort, view toggle -->
    <ProductListToolbar
      :result-count="totalCount"
      :sort-value="sortBy"
      :sort-options="sortOptions"
      :view-mode="viewMode"
      :filter-text="filterText"
      :has-active-filters="Object.keys(filterState ?? {}).length > 0"
      @update:sort-value="sortBy = $event"
      @update:view-mode="viewMode = $event"
      @update:filter-text="filterText = $event"
      @reset-filters="clearAllFilters"
    >
      <template #filters>
        <ProductFilters
          v-if="facets && facets.length > 0"
          v-model="filterState"
          :facets="facets"
        />
      </template>
    </ProductListToolbar>

    <!-- Loading skeleton -->
    <ProductListSkeleton
      v-if="isLoading && products.length === 0"
      :view-mode="viewMode"
      data-testid="plp-loading"
    />

    <!-- Product grid/list -->
    <div
      v-else
      :class="
        viewMode === 'grid'
          ? 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'
          : 'flex flex-col gap-0'
      "
    >
      <ProductCard
        v-for="product in products"
        :key="product.productId"
        :product="product"
        :variant="viewMode"
      />
    </div>

    <!-- Empty state -->
    <div v-if="!isLoading && products.length === 0" data-testid="plp-empty">
      <EmptyState
        :icon="PackageIcon"
        :title="$t('product.no_products')"
        :description="$t('product.no_products_description')"
      />
      <div
        v-if="Object.keys(filterState ?? {}).length > 0"
        class="mt-4 text-center"
      >
        <button
          type="button"
          class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          @click="clearAllFilters"
        >
          {{ $t('product.clear_all') }}
        </button>
      </div>
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
