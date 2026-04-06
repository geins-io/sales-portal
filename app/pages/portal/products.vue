<script setup lang="ts">
import type { PurchasedProduct } from '#shared/types/commerce';
import { Input } from '~/components/ui/input';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();

const { data, pending, error, refresh } = useFetch<{
  products: PurchasedProduct[];
  total: number;
}>('/api/orders/products', { dedupe: 'defer' });

const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const pageSizeOptions = [10, 25, 50];
const sortDirection = ref<'asc' | 'desc'>('asc');

const allProducts = computed(() => data.value?.products ?? []);

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allProducts.value;
  return allProducts.value.filter(
    (p) =>
      p.name?.toLowerCase().includes(q) ||
      p.articleNumber?.toLowerCase().includes(q),
  );
});

const sortedProducts = computed(() => {
  const products = [...filteredProducts.value];
  products.sort((a, b) => {
    const nameA = (a.name ?? '').toLowerCase();
    const nameB = (b.name ?? '').toLowerCase();
    return sortDirection.value === 'asc'
      ? nameA.localeCompare(nameB)
      : nameB.localeCompare(nameA);
  });
  return products;
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedProducts.value.length / pageSize.value)),
);

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return sortedProducts.value.slice(start, start + pageSize.value);
});

const showingCount = computed(() =>
  Math.min(currentPage.value * pageSize.value, sortedProducts.value.length),
);

const showPagination = computed(
  () => sortedProducts.value.length > pageSize.value,
);

function handleSort(_column: string) {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

// Reset to page 1 when search or page size changes
watch(searchQuery, () => {
  currentPage.value = 1;
});

watch(pageSize, () => {
  currentPage.value = 1;
});
</script>

<template>
  <PortalShell>
    <!-- Page header -->
    <div
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <h2 class="text-xl font-semibold">
        {{ t('portal.purchased_products.title') }}
      </h2>
      <!-- Search -->
      <Input
        v-model="searchQuery"
        type="search"
        data-testid="products-search"
        class="w-full sm:w-72"
        :placeholder="t('portal.purchased_products.search_placeholder')"
      />
    </div>

    <!-- Rows per page selector -->
    <div class="mb-4 flex items-center gap-2">
      <label for="products-page-size" class="text-muted-foreground text-sm">
        {{ t('portal.purchased_products.pagination.rows_per_page') }}
      </label>
      <select
        id="products-page-size"
        v-model.number="pageSize"
        data-testid="products-page-size"
        class="border-border bg-background rounded-md border px-2 py-1 text-sm"
      >
        <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">
          {{ opt }}
        </option>
      </select>
    </div>

    <!-- Loading state -->
    <div
      v-if="pending"
      data-testid="products-loading"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('common.loading') }}
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      data-testid="products-error"
      class="py-12 text-center"
    >
      <p class="text-muted-foreground mb-4 text-sm">
        {{ t('portal.purchased_products.error_loading') }}
      </p>
      <button
        data-testid="products-retry"
        class="text-primary hover:text-primary/80 text-sm font-medium"
        @click="refresh()"
      >
        {{ t('portal.purchased_products.retry') }}
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!sortedProducts.length && !searchQuery.trim()"
      data-testid="products-empty"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.purchased_products.no_products') }}
    </div>

    <!-- Empty search state -->
    <div
      v-else-if="!sortedProducts.length && searchQuery.trim()"
      data-testid="products-empty"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.purchased_products.no_search_results') }}
    </div>

    <!-- Products table -->
    <template v-else>
      <PortalProductsTable
        :products="paginatedProducts"
        sort-column="name"
        :sort-direction="sortDirection"
        @sort="handleSort"
      />

      <!-- Pagination -->
      <div
        v-if="showPagination"
        data-testid="products-pagination"
        class="mt-4 flex items-center justify-between"
      >
        <span
          data-testid="products-showing-count"
          class="text-muted-foreground text-sm"
        >
          {{
            t('portal.purchased_products.pagination.showing', {
              shown: showingCount,
              total: sortedProducts.length,
            })
          }}
        </span>
        <div class="flex items-center gap-2">
          <button
            data-testid="products-previous"
            class="text-primary hover:text-primary/80 rounded px-3 py-1 text-sm font-medium disabled:opacity-50"
            :disabled="currentPage <= 1"
            @click="goToPage(currentPage - 1)"
          >
            {{ t('portal.purchased_products.pagination.previous') }}
          </button>
          <template v-for="page in totalPages" :key="page">
            <button
              v-if="
                page === 1 ||
                page === totalPages ||
                Math.abs(page - currentPage) <= 1
              "
              class="rounded px-3 py-1 text-sm"
              :class="
                page === currentPage
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
            <span
              v-else-if="
                page === 2 && currentPage > 3
                  ? true
                  : page === totalPages - 1 && currentPage < totalPages - 2
              "
              class="text-muted-foreground px-1"
              >...</span
            >
          </template>
          <button
            data-testid="products-next"
            class="text-primary hover:text-primary/80 rounded px-3 py-1 text-sm font-medium disabled:opacity-50"
            :disabled="currentPage >= totalPages"
            @click="goToPage(currentPage + 1)"
          >
            {{ t('portal.purchased_products.pagination.next') }}
          </button>
        </div>
      </div>
    </template>
  </PortalShell>
</template>
