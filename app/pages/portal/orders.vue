<script setup lang="ts">
import type { OrderListItem } from '#shared/types/commerce';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();

const { data, pending, error, refresh } = useFetch<{
  orders: OrderListItem[];
  total: number;
}>('/api/orders', { dedupe: 'defer' });

const searchQuery = ref('');
const sortDirection = ref<'asc' | 'desc'>('desc');

const allOrders = computed(() => data.value?.orders ?? []);

const filteredOrders = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allOrders.value;
  return allOrders.value.filter((order) => {
    const idStr = String(order.id ?? '').toLowerCase();
    const firstName = order.billingAddress?.firstName?.toLowerCase() ?? '';
    const lastName = order.billingAddress?.lastName?.toLowerCase() ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    return idStr.includes(q) || fullName.includes(q);
  });
});

const sortedOrders = computed(() => {
  const orders = [...filteredOrders.value];
  orders.sort((a, b) => {
    const dateA = new Date(a.createdAt ?? 0).getTime();
    const dateB = new Date(b.createdAt ?? 0).getTime();
    return sortDirection.value === 'desc' ? dateB - dateA : dateA - dateB;
  });
  return orders;
});

const {
  currentPage,
  pageSize,
  totalPages,
  paginatedItems: paginatedOrders,
  showPagination,
  goToPage,
} = usePagination<OrderListItem>({
  source: () => sortedOrders.value,
  pageSize: 20,
  resetOn: [() => searchQuery.value],
});

const showingCount = computed(() =>
  Math.min(currentPage.value * pageSize.value, sortedOrders.value.length),
);

function handleSort(_column: string) {
  sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc';
}
</script>

<template>
  <PortalShell>
    <!-- Page header -->
    <div class="mb-6">
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h2 class="text-xl font-semibold">
            {{ t('portal.orders.title') }}
          </h2>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ t('portal.orders.subtitle') }}
          </p>
        </div>
        <!-- Search -->
        <Input
          v-model="searchQuery"
          type="search"
          data-testid="orders-search"
          class="w-full shrink-0 sm:w-64"
          :placeholder="t('portal.orders.quick_search')"
        />
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="pending"
      data-testid="orders-loading"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('common.loading') }}
    </div>

    <!-- Error state -->
    <div v-else-if="error" data-testid="orders-error" class="py-12 text-center">
      <p class="text-muted-foreground mb-4 text-sm">
        {{ t('portal.orders.error_loading') }}
      </p>
      <Button
        data-testid="orders-retry"
        variant="link"
        size="sm"
        @click="refresh()"
      >
        {{ t('portal.orders.retry') }}
      </Button>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!sortedOrders.length"
      data-testid="orders-empty"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.orders.no_orders') }}
    </div>

    <!-- Orders table -->
    <template v-else>
      <PortalOrdersTable
        :orders="paginatedOrders"
        :sort-direction="sortDirection"
        @sort="handleSort"
      />

      <!-- Pagination -->
      <div
        v-if="showPagination"
        data-testid="orders-pagination"
        class="mt-4 flex items-center justify-between"
      >
        <span
          data-testid="orders-showing-count"
          class="text-muted-foreground text-sm"
        >
          {{
            t('portal.orders.pagination.showing', {
              shown: showingCount,
              total: sortedOrders.length,
            })
          }}
        </span>
        <div class="flex items-center gap-2">
          <Button
            data-testid="orders-previous"
            variant="ghost"
            size="sm"
            :disabled="currentPage <= 1"
            @click="goToPage(currentPage - 1)"
          >
            {{ t('portal.orders.pagination.previous') }}
          </Button>
          <template v-for="page in totalPages" :key="page">
            <Button
              v-if="
                page === 1 ||
                page === totalPages ||
                Math.abs(page - currentPage) <= 1
              "
              :variant="page === currentPage ? 'default' : 'ghost'"
              size="sm"
              @click="goToPage(page)"
            >
              {{ page }}
            </Button>
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
          <Button
            data-testid="orders-next"
            variant="ghost"
            size="sm"
            :disabled="currentPage >= totalPages"
            @click="goToPage(currentPage + 1)"
          >
            {{ t('portal.orders.pagination.next') }}
          </Button>
        </div>
      </div>
    </template>
  </PortalShell>
</template>
