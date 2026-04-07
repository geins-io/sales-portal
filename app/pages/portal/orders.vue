<script setup lang="ts">
import type { OrderListItem } from '#shared/types/commerce';
import { Input } from '~/components/ui/input';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();

const { data, pending, error, refresh } = useFetch<{
  orders: OrderListItem[];
  total: number;
}>('/api/orders', { dedupe: 'defer' });

const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = 20;
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

const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedOrders.value.length / pageSize)),
);

const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return sortedOrders.value.slice(start, start + pageSize);
});

const showingCount = computed(() =>
  Math.min(currentPage.value * pageSize, sortedOrders.value.length),
);

const showPagination = computed(() => sortedOrders.value.length > pageSize);

function handleSort(_column: string) {
  sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc';
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

// Reset to page 1 when search changes
watch(searchQuery, () => {
  currentPage.value = 1;
});
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
      <button
        data-testid="orders-retry"
        class="text-primary hover:text-primary/80 focus-visible:ring-ring rounded text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        @click="refresh()"
      >
        {{ t('portal.orders.retry') }}
      </button>
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
          <button
            data-testid="orders-previous"
            class="text-primary hover:text-primary/80 focus-visible:ring-ring rounded px-3 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            :disabled="currentPage <= 1"
            @click="goToPage(currentPage - 1)"
          >
            {{ t('portal.orders.pagination.previous') }}
          </button>
          <template v-for="page in totalPages" :key="page">
            <button
              v-if="
                page === 1 ||
                page === totalPages ||
                Math.abs(page - currentPage) <= 1
              "
              class="focus-visible:ring-ring rounded px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
            data-testid="orders-next"
            class="text-primary hover:text-primary/80 focus-visible:ring-ring rounded px-3 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            :disabled="currentPage >= totalPages"
            @click="goToPage(currentPage + 1)"
          >
            {{ t('portal.orders.pagination.next') }}
          </button>
        </div>
      </div>
    </template>
  </PortalShell>
</template>
