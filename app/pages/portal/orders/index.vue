<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import type { OrderListPage } from '#shared/types/commerce';
import {
  ORDER_LIST_PAGE_SIZE,
  ORDER_SEARCH_MAX_LENGTH,
} from '#shared/constants/order';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';

definePageMeta({
  middleware: ['auth', 'feature'],
  feature: 'orderHistory',
});

const { t } = useI18n();

const searchQuery = ref('');
/** The search the rows were read with, once the typing has paused. */
const appliedSearch = refDebounced(
  computed(() => searchQuery.value.trim()),
  300,
);
/** Only the buyer's own orders, rather than the company's. */
const mineOnly = ref(false);
const currentPage = ref(1);

// Before the query recomputes, so a new search or switch reads its first page
// rather than the page the old one was on.
watch([appliedSearch, mineOnly], () => (currentPage.value = 1), {
  flush: 'sync',
});

const listQuery = computed(() => ({
  ...(mineOnly.value ? { mine: true } : {}),
  ...(appliedSearch.value ? { search: appliedSearch.value } : {}),
  skip: (currentPage.value - 1) * ORDER_LIST_PAGE_SIZE,
  take: ORDER_LIST_PAGE_SIZE,
}));

// The query changes with page, search and switch: the newest read wins.
const { data, pending, error, refresh } = useFetch<OrderListPage>(
  '/api/orders',
  { query: listQuery, dedupe: 'cancel' },
);
const orders = computed(() => data.value?.orders ?? []);
const total = computed(() => data.value?.total ?? 0);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / ORDER_LIST_PAGE_SIZE)),
);
const showPagination = computed(() => total.value > ORDER_LIST_PAGE_SIZE);

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) currentPage.value = page;
}

/** The orders up to the end of this page, as the summary has always counted. */
const showingCount = computed(() =>
  Math.min(listQuery.value.skip + orders.value.length, total.value),
);

const paginationSummary = usePaginationSummary(showingCount, total, 'orders');
</script>

<template>
  <PortalShell>
    <div class="border-card-border rounded-lg border bg-white p-6">
      <!-- Page header -->
      <div class="mb-6">
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div data-testid="orders-heading">
            <h2 class="text-2xl font-semibold">
              {{ t('portal.orders.title') }}
            </h2>
            <p class="text-muted-foreground mt-1 text-sm">
              {{ t('portal.orders.subtitle') }}
            </p>
            <div class="mt-3 flex items-center gap-2">
              <Switch
                id="orders-mine"
                v-model="mineOnly"
                data-testid="orders-mine"
              />
              <Label for="orders-mine" class="font-normal">
                {{ t('portal.orders.only_mine') }}
              </Label>
            </div>
          </div>
          <!-- Search -->
          <Input
            v-model="searchQuery"
            type="search"
            data-testid="orders-search"
            class="w-full shrink-0 sm:w-64"
            :maxlength="ORDER_SEARCH_MAX_LENGTH"
            :placeholder="t('portal.orders.search_placeholder')"
            :aria-label="t('portal.orders.search_placeholder')"
          />
        </div>
      </div>

      <!-- Loading state -->
      <div
        v-if="pending && !data"
        data-testid="orders-loading"
        class="text-muted-foreground py-12 text-center text-sm"
      >
        {{ t('common.loading') }}
      </div>

      <!-- Error state -->
      <div
        v-else-if="error"
        data-testid="orders-error"
        class="py-12 text-center"
      >
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
        v-else-if="!orders.length"
        data-testid="orders-empty"
        class="text-muted-foreground py-12 text-center text-sm"
      >
        {{ t('portal.orders.no_orders') }}
      </div>

      <!-- Orders table -->
      <template v-else>
        <PortalOrdersTable :orders="orders" />

        <!-- Pagination. Below sm the summary sits above the controls and
             previous/next are chevrons: side by side, with their text, the
             row was wider than a phone screen. -->
        <div
          v-if="showPagination"
          data-testid="orders-pagination"
          class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <span
            data-testid="orders-showing-count"
            :data-shown="showingCount"
            :data-total="total"
            class="text-muted-foreground text-sm"
          >
            {{ paginationSummary }}
          </span>
          <div class="flex flex-wrap items-center gap-2">
            <Button
              data-testid="orders-previous"
              variant="ghost"
              size="sm"
              :disabled="currentPage <= 1"
              :aria-label="t('portal.orders.pagination.previous')"
              @click="goToPage(currentPage - 1)"
            >
              <ChevronLeft class="size-4 sm:hidden" aria-hidden="true" />
              <span class="hidden sm:inline">{{
                t('portal.orders.pagination.previous')
              }}</span>
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
              :aria-label="t('portal.orders.pagination.next')"
              @click="goToPage(currentPage + 1)"
            >
              <span class="hidden sm:inline">{{
                t('portal.orders.pagination.next')
              }}</span>
              <ChevronRight class="size-4 sm:hidden" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </template>
    </div>
  </PortalShell>
</template>
