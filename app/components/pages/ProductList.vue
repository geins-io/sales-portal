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

// --- State ---
const filterState = ref<Record<string, string[]>>({});
const sortBy = ref('relevance');
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

// --- Data Fetching ---
const queryParams = computed(() => ({
  ...(isBrand.value
    ? { brandAlias: listSlug.value }
    : { categoryAlias: listSlug.value }),
  skip: skip.value,
  take,
  ...(debouncedFilterText.value
    ? { searchText: debouncedFilterText.value }
    : {}),
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
const facets = computed(() => filtersData.value?.filters ?? []);
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
    for (const [key, values] of Object.entries(filterState.value)) {
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
  // Scroll to top of product grid
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <ProductActiveFilters
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
      :has-active-filters="Object.keys(filterState).length > 0"
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

    <!-- Product grid/list -->
    <div
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

    <!-- Empty state -->
    <div
      v-if="!isLoading && products && products.length === 0"
      class="py-12 text-center"
    >
      <p class="text-muted-foreground">{{ $t('product.no_products') }}</p>
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
