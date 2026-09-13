<script setup lang="ts">
import type { OrderListItem } from '#shared/types/commerce';
import { useIntervalFn } from '@vueuse/core';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

definePageMeta({
  middleware: ['auth', 'feature'],
  feature: 'orderHistory',
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

type OrderListResponse = { orders: OrderListItem[]; total: number };

const { data, pending, error, refresh } = useFetch<OrderListResponse>(
  '/api/orders',
  { dedupe: 'defer' },
);

/**
 * Waiting for a just-placed order to become readable.
 *
 * The platform makes an order readable 5 to 47 seconds after confirming it was
 * created (five samples, 2026-09-13), so a buyer who follows the confirmation
 * link arrives before their order exists on this list. `?awaiting=<publicId>`
 * is set by that link and names the order to wait for. Nothing polls without
 * it, and nothing polls if the order is already in the first response.
 *
 * Silent by design: the row simply appears. The page says nothing about
 * waiting, so there is no state to explain and nothing to dismiss.
 */
const awaitingId = computed(() => {
  const value = route.query.awaiting;
  return typeof value === 'string' && value ? value : null;
});

/**
 * Drop `?awaiting=` once the wait is over, either way it ended.
 *
 * `replace` rather than `push`, and the path is unchanged, so this rewrites the
 * address without a navigation and without leaving a back-button step. Clearing
 * it after the bound too means a reload does not start a fresh wait for an order
 * that is already known to be slow.
 */
async function clearAwaitingParam() {
  if (!awaitingId.value) return;
  const { awaiting: _dropped, ...rest } = route.query;
  await router.replace({ query: rest });
}

/** 120s, and the order-placement e2e spec gives the platform exactly the same
 * number. Two different bounds would disagree about a platform that landed
 * between them — one calling it healthy while the other called it late. It
 * rests on five samples measured 2026-09-13 with a 46.7s maximum, so roughly
 * two and a half times the worst seen. Raising it needs new measurements. */
const AWAITING_BOUND_MS = 120000;

/** The window is 5-47s, so tighter buys nothing and looser wastes the wait. */
const AWAITING_INTERVAL_MS = 2500;

let awaitingStartedAt = 0;
let pollInFlight = false;

function hasAwaitedOrder(
  response: OrderListResponse | null | undefined,
): boolean {
  const id = awaitingId.value;
  if (!id) return true;
  return (response?.orders ?? []).some((order) => order.publicId === id);
}

/**
 * One refetch while waiting, with the browser cache bypassed.
 *
 * `/api/orders` answers `Cache-Control: private, max-age=30`, which the
 * browser's fetch honours — so an ordinary refetch would be served the same
 * order-less list from cache for up to thirty seconds and never reach the
 * server. `cache: 'no-store'` is scoped to this call rather than put on the
 * `useFetch` above, because that header is right for every other visit to this
 * page and `refresh()` would reuse those options.
 */
async function pollForAwaitedOrder() {
  // The bound is checked before the in-flight guard, so a request that never
  // comes back cannot postpone it for ever.
  if (Date.now() - awaitingStartedAt > AWAITING_BOUND_MS) {
    stopAwaiting();
    await clearAwaitingParam();
    return;
  }

  // The interval fires on a timer, not on the previous response, so without
  // this two requests overlap once `/api/orders` outlasts the interval.
  if (pollInFlight) return;
  pollInFlight = true;

  try {
    const fresh = await $fetch<OrderListResponse>('/api/orders', {
      cache: 'no-store',
    });
    // The wait may have ended while this was out — stopped at the bound, or
    // the page unmounted. Either way its answer is no longer wanted, which is
    // also what makes a request still in flight at unmount a non-issue.
    if (!pollIsActive.value) return;
    data.value = fresh;
    if (hasAwaitedOrder(fresh)) {
      stopAwaiting();
      // After the row is on screen, not before — the parameter is what keeps
      // the wait alive, so dropping it early would end the wait it describes.
      await nextTick();
      await clearAwaitingParam();
    }
  } catch {
    // A failed poll is not a failed order — the next tick tries again, and the
    // bound above ends it either way.
  } finally {
    pollInFlight = false;
  }
}

const {
  pause: stopAwaiting,
  resume: startAwaiting,
  isActive: pollIsActive,
} = useIntervalFn(pollForAwaitedOrder, AWAITING_INTERVAL_MS, {
  immediate: false,
});

// Starts only once the first response has arrived and does not contain the
// order. `useIntervalFn` is paused on scope dispose, so leaving the page stops
// it without any teardown of our own.
watch(
  () => pending.value,
  (isPending) => {
    // Explicit rather than implied: this never runs on the server. Nothing
    // would start there today, but that rests on facts elsewhere in the file.
    if (!import.meta.client) return;
    if (isPending || !awaitingId.value || hasAwaitedOrder(data.value)) return;
    awaitingStartedAt = Date.now();
    startAwaiting();
  },
  { immediate: true },
);

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

const paginationSummary = usePaginationSummary(
  showingCount,
  computed(() => sortedOrders.value.length),
  'orders',
);

function handleSort(_column: string) {
  sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc';
}
</script>

<template>
  <PortalShell>
    <div class="border-border rounded-lg border bg-white p-6">
      <!-- Page header -->
      <div class="mb-6">
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <h2 class="text-2xl font-semibold">
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
            {{ paginationSummary }}
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
    </div>
  </PortalShell>
</template>
