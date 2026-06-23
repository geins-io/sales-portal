<script setup lang="ts">
import type { BreadcrumbItem } from '#shared/types/common';
import type {
  ListPageInfo,
  ProductListResponse,
  ProductFiltersResponse,
} from '#shared/types/commerce';
import type { ContentAreaType } from '#shared/types/cms';
import { CMS_SLOTS } from '#shared/types/cms-slots';
import { Package as PackageIcon } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useDebounceFn } from '@vueuse/core';
import {
  buildFilterInput,
  SORT_MAP,
  isPriceFacet,
  isStockFacet,
} from '#shared/utils/filters';
import {
  canonicalListRedirectTarget,
  productPath,
} from '#shared/utils/route-helpers';
import { recoverEntityUrl } from '~/composables/useEntityUrlRecovery';

const props = defineProps<{
  type: 'category' | 'brand';
  alias: string;
}>();

const isBrand = computed(() => props.type === 'brand');
const listSlug = computed(() => props.alias);

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

const { showPrice } = usePriceVisibility();
const { showStock } = useStockVisibility();

function stripHiddenFacetKeys(
  state: Record<string, string[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(state ?? {})) {
    const identity = { type: key, filterId: key };
    if (!showPrice.value && isPriceFacet(identity)) continue;
    if (!showStock.value && isStockFacet(identity)) continue;
    result[key] = values;
  }
  return result;
}

const filterState = ref<Record<string, string[]>>(
  stripHiddenFacetKeys(restoreFiltersFromQuery()),
);
// Product lists (category and brand) default to newest. Relevance with no
// sort param yields a non-deterministic API order that reshuffles on reload,
// so newest gives a stable, predictable ordering. Search uses relevance.
const DEFAULT_SORT = 'newest';
const sortBy = ref(
  typeof route.query.sort === 'string' ? route.query.sort : DEFAULT_SORT,
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
const { localePath, currentLocale, currentMarket, localeQuery } =
  useLocaleMarket();
// Price sorts are meaningless when the tenant hides prices, so gate them on
// the same store-settings visibility flag the price facet and VAT selector
// already use (usePriceVisibility -> showPrice).
const sortOptions = computed(() => {
  const options = [
    { label: t('product.sort_relevance'), value: 'relevance' },
    { label: t('product.sort_price_asc'), value: 'price-asc' },
    { label: t('product.sort_price_desc'), value: 'price-desc' },
    { label: t('product.sort_newest'), value: 'newest' },
    { label: t('product.sort_name_asc'), value: 'name-asc' },
  ];
  if (showPrice.value) return options;
  return options.filter(
    (o) => o.value !== 'price-asc' && o.value !== 'price-desc',
  );
});

// --- Build filter object for GraphQL FilterInputType ---
const filterInput = computed(() =>
  buildFilterInput(
    filterState.value,
    sortBy.value,
    debouncedFilterText.value || undefined,
    SORT_MAP,
  ),
);

// --- Data Fetching ---
const queryParams = computed(() => ({
  ...(isBrand.value
    ? { brandAlias: listSlug.value }
    : { categoryAlias: listSlug.value }),
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
    query: computed(() => ({
      ...(isBrand.value
        ? { brandAlias: listSlug.value }
        : { categoryAlias: listSlug.value }),
      ...localeQuery.value,
    })),
    dedupe: 'defer',
  },
);

const pageInfoUrl = computed(() =>
  isBrand.value
    ? `/api/product-lists/brand/${listSlug.value}`
    : `/api/product-lists/category/${listSlug.value}`,
);

const { data: pageInfo, error: pageInfoError } = await useFetch<ListPageInfo>(
  pageInfoUrl,
  {
    query: localeQuery,
    dedupe: 'defer',
  },
);

// On a content miss (missing brand/category or fetch error) the old slug may
// be a renamed/old listing that should 301 to its canonical instead of 404ing
// (Problem B). recoverEntityUrl consults the resolver, 301s to the canonical
// (or a urlHistory redirect), and throws a fatal 404 only on a terminal miss.
// Without this, crawlers would index phantom URLs.
if (pageInfoError.value || !pageInfo.value?.id) {
  await recoverEntityUrl(useRoute().path);
}

// Publish this list's per-locale alternate URLs so the language switcher can
// land on the target-language slug. props.type ('category' | 'brand') selects
// the /c/ vs /b/ prefix in the composable. Immediate so a hard refresh has the
// alternate ready; null clears so an empty page never retains stale alternates.
const { setAlternates, alternates: localeAlternates } = useLocaleAlternates();
watch(
  pageInfo,
  (info) => setAlternates(info?.alternativeUrls, { type: props.type }),
  { immediate: true },
);

// Canonical URL self-correction. Geins returns prefix-less canonicals; when a
// listing is reached at a non-canonical but valid URL (e.g. a short /c/<alias>
// breadcrumb link, or a per-language fallback), issue a real 301 to the
// routable /c/ or /b/ form so crawlers and hard loads land on the canonical.
//
// SERVER-SIDE ONLY. On a hard load or crawler hit the server issues a real
// 301; on client-side SPA navigation the redirect is skipped. A client-side
// navigateTo({ replace: true }) here re-ran the non-awaited product/filter
// fetches mid-navigation, and under that burst Geins intermittently 503s; the
// errored response blanked the grid until a manual reload. Leaving the address
// bar on the valid clicked URL is harmless: rel=canonical still
// points crawlers at the canonical, and a hard load of that URL still 301s.
// Content-miss recovery (recoverEntityUrl, above) deliberately stays
// client-side because a renamed slug must still recover on in-app navigation.
if (import.meta.server) {
  const target = canonicalListRedirectTarget(
    pageInfo.value?.canonicalUrl,
    useRoute().path,
    props.type,
    localePath,
  );
  if (target) {
    await navigateTo(target, { redirectCode: 301, replace: true });
  }
}

// --- Derived ---
const facets = computed(() => {
  const all = filtersData.value?.filters?.facets ?? [];
  return all.filter(
    (f) =>
      (showPrice.value || !isPriceFacet(f)) &&
      (showStock.value || !isStockFacet(f)),
  );
});
const totalCount = computed(() => productsData.value?.count ?? 0);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalCount.value / take)),
);
const isLoading = computed(() => productsStatus.value === 'pending');
const products = computed(() => productsData.value?.products ?? []);

// Clamp currentPage if the URL asks for a page beyond the total. Without
// this, "?page=5" on a 15-product list renders "Showing 97–15 of 15".
watch([totalPages, currentPage], ([pages, page]) => {
  if (pages > 0 && page > pages) {
    currentPage.value = 1;
  }
});

const showingFrom = computed(() => {
  if (totalCount.value === 0) return 0;
  const from = skip.value + 1;
  return from > totalCount.value ? totalCount.value : from;
});
const showingTo = computed(() => Math.min(skip.value + take, totalCount.value));

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [
    { label: t('common.home'), href: localePath('/') },
  ];
  if (pageInfo.value?.name) {
    items.push({ label: pageInfo.value.name, current: true });
  }
  return items;
});

// --- SEO ---
const typePrefix = computed(() => (isBrand.value ? 'b' : 'c'));
const listPath = computed(() => `/${typePrefix.value}/${listSlug.value}`);
// localeAlternates holds the real per-locale slugs published by setAlternates
// above (populated with immediate:true so the watch fires before this line).
// It is useState-backed (SSR-safe, no window) and reactive so hreflang stays
// correct after client-side navigation without any hydration mismatch.
const { seoLinks } = useSeoLinks(listPath, localeAlternates);

useHead({
  title: () =>
    pageInfo.value?.name ||
    props.alias.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
});

useSeoMeta({
  description: () => pageInfo.value?.primaryDescription?.slice(0, 160) ?? '',
  ogTitle: () => pageInfo.value?.name ?? '',
  ogDescription: () => pageInfo.value?.primaryDescription?.slice(0, 160) ?? '',
  ogUrl: () => seoLinks.value.find((l) => l.rel === 'canonical')?.href ?? '',
});

// JSON-LD structured data (Schema.org BreadcrumbList + ItemList)
useSchemaOrg([
  defineBreadcrumb({
    itemListElement: () =>
      breadcrumbs.value.map((bc, i) => ({
        '@type': 'ListItem' as const,
        position: i + 1,
        name: bc.label,
        item: bc.href,
      })),
  }),
  defineItemList({
    itemListElement: () =>
      products.value.map((p, i) => ({
        '@type': 'ListItem' as const,
        position: i + 1,
        name: p.name,
        url: p.alias ? localePath(productPath(`/${p.alias}`)) : undefined,
      })),
  }),
]);

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
    if (sortBy.value !== DEFAULT_SORT) {
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

// --- CMS zones above + below the product grid ---
// Rendered only when the tenant has configured the slot AND the area
// returns at least one container. A missing slot or empty area simply
// omits the zone; the product grid itself is the primary content and
// still renders regardless. Uses the existing `currentLocale` /
// `currentMarket` destructured above.
const topSlot = useCmsSlot(CMS_SLOTS.PRODUCT_LIST_TOP);
const bottomSlot = useCmsSlot(CMS_SLOTS.PRODUCT_LIST_BOTTOM);

function buildAreaQuery(slot: typeof topSlot) {
  return computed(() =>
    slot.value
      ? {
          family: slot.value.family,
          areaName: slot.value.areaName,
          ...(currentLocale.value ? { locale: currentLocale.value } : {}),
          ...(currentMarket.value ? { market: currentMarket.value } : {}),
        }
      : { skip: '1' },
  );
}

const { data: topArea } = useFetch<ContentAreaType>('/api/cms/area', {
  query: buildAreaQuery(topSlot),
  immediate: !!topSlot.value,
  dedupe: 'defer',
  lazy: true,
});

const { data: bottomArea } = useFetch<ContentAreaType>('/api/cms/area', {
  query: buildAreaQuery(bottomSlot),
  immediate: !!bottomSlot.value,
  dedupe: 'defer',
  lazy: true,
});
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6">
    <!-- CMS zone above the product grid (tenant-configurable via
         CMS_SLOTS.PRODUCT_LIST_TOP). Omitted if slot unconfigured or
         area empty. -->
    <CmsWidgetArea
      v-if="topArea?.containers?.length"
      data-testid="plp-cms-top"
      :containers="topArea.containers"
    />

    <!-- Header: breadcrumbs, title, description, sub-categories -->
    <ProductListHeader
      :page-info="pageInfo ?? null"
      :breadcrumbs="breadcrumbs"
      :result-count="totalCount"
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
          : 'flex flex-col gap-3'
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
        <Button @click="clearAllFilters">
          {{ $t('product.clear_all') }}
        </Button>
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

    <!-- CMS zone below the product grid (tenant-configurable via
         CMS_SLOTS.PRODUCT_LIST_BOTTOM). Omitted if unconfigured or
         empty. -->
    <CmsWidgetArea
      v-if="bottomArea?.containers?.length"
      data-testid="plp-cms-bottom"
      :containers="bottomArea.containers"
    />
  </div>
</template>
