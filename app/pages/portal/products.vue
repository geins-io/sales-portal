<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import type {
  PurchasedProduct,
  PurchasedProductSortColumn,
} from '#shared/types/commerce';
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
const sortColumn = ref<PurchasedProductSortColumn>('latestOrderDate');
const sortDirection = ref<'asc' | 'desc'>('desc');

/** The direction a column starts in when it is first clicked. */
const firstDirection: Record<PurchasedProductSortColumn, 'asc' | 'desc'> = {
  name: 'asc',
  totalQuantity: 'desc',
  latestOrderDate: 'desc',
};

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

function compareNames(a: PurchasedProduct, b: PurchasedProduct): number {
  return (a.name ?? '')
    .toLowerCase()
    .localeCompare((b.name ?? '').toLowerCase());
}

/** NaN for an empty or unparseable date. */
function orderTime(product: PurchasedProduct): number {
  return new Date(product.latestOrderDate).getTime();
}

const sortedProducts = computed(() => {
  const sign = sortDirection.value === 'asc' ? 1 : -1;
  const products = [...filteredProducts.value];
  products.sort((a, b) => {
    if (sortColumn.value === 'name') return sign * compareNames(a, b);
    let diff: number;
    if (sortColumn.value === 'totalQuantity') {
      diff = a.totalQuantity - b.totalQuantity;
    } else {
      const timeA = orderTime(a);
      const timeB = orderTime(b);
      const undatedA = Number.isNaN(timeA);
      // Undated rows go last whichever way the column runs.
      if (undatedA !== Number.isNaN(timeB)) return undatedA ? 1 : -1;
      diff = undatedA ? 0 : timeA - timeB;
    }
    return sign * diff || compareNames(a, b);
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
  resetOn: [
    () => searchQuery.value,
    () => sortColumn.value,
    () => sortDirection.value,
  ],
});

function handleSort(column: PurchasedProductSortColumn) {
  if (column === sortColumn.value) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = firstDirection[column];
  }
}
</script>

<template>
  <PortalShell>
    <div class="border-border rounded-lg border bg-white p-6">
      <!-- Page header -->
      <div
        class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h2 class="text-2xl font-semibold">
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
          :sort-column="sortColumn"
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
            <label
              for="products-page-size"
              class="text-muted-foreground text-sm"
            >
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
                <ChevronLeft class="size-4" />
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
                <ChevronRight class="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </PortalShell>
</template>
