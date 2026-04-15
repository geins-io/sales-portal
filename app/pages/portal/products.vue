<script setup lang="ts">
import type { PurchasedProduct } from '#shared/types/commerce';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();

const { data, pending, error, refresh } = useFetch<{
  products: PurchasedProduct[];
  total: number;
}>('/api/orders/products', { dedupe: 'defer' });

const searchQuery = ref('');
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

const {
  currentPage,
  totalPages,
  paginatedItems: paginatedProducts,
  showPagination,
  goToPage,
} = usePagination<PurchasedProduct>({
  source: () => sortedProducts.value,
  pageSize,
  resetOn: [() => searchQuery.value],
});

function handleSort(_column: string) {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
}
</script>

<template>
  <PortalShell>
    <!-- Page header -->
    <div
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h2 class="text-xl font-semibold">
          {{ t('portal.purchased_products.title') }}
        </h2>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ t('portal.purchased_products.subtitle') }}
        </p>
      </div>
      <!-- Search -->
      <Input
        v-model="searchQuery"
        type="search"
        data-testid="products-search"
        class="w-full sm:w-72"
        :placeholder="t('portal.purchased_products.search_placeholder')"
      />
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
      <Button
        data-testid="products-retry"
        variant="link"
        size="sm"
        @click="refresh()"
      >
        {{ t('portal.purchased_products.retry') }}
      </Button>
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

      <!-- Footer: Rows per page + Pagination -->
      <div
        data-testid="products-pagination"
        class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <!-- Rows per page selector -->
        <div class="flex items-center gap-2">
          <label for="products-page-size" class="text-muted-foreground text-sm">
            {{ t('portal.purchased_products.pagination.rows_per_page') }}
          </label>
          <select
            id="products-page-size"
            v-model.number="pageSize"
            data-testid="products-page-size"
            class="border-input bg-background focus-visible:ring-ring rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">
              {{ opt }}
            </option>
          </select>
        </div>

        <!-- Page indicator + navigation -->
        <div v-if="showPagination" class="flex items-center gap-3">
          <span
            data-testid="products-showing-count"
            class="text-muted-foreground text-sm"
          >
            {{
              t('portal.purchased_products.pagination.page_of', {
                current: currentPage,
                total: totalPages,
              })
            }}
          </span>
          <div class="flex items-center gap-1">
            <Button
              data-testid="products-previous"
              variant="ghost"
              size="icon"
              class="size-8"
              :disabled="currentPage <= 1"
              :aria-label="t('portal.purchased_products.pagination.previous')"
              @click="goToPage(currentPage - 1)"
            >
              <Icon name="lucide:chevron-left" class="size-4" />
            </Button>
            <Button
              data-testid="products-next"
              variant="ghost"
              size="icon"
              class="size-8"
              :disabled="currentPage >= totalPages"
              :aria-label="t('portal.purchased_products.pagination.next')"
              @click="goToPage(currentPage + 1)"
            >
              <Icon name="lucide:chevron-right" class="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </template>
  </PortalShell>
</template>
