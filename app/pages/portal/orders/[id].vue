<script setup lang="ts">
import { ArrowLeft, LoaderCircle, RotateCw } from 'lucide-vue-next';
import type { OrderDetailType } from '#shared/types/commerce';
import type { PortalItemRow, PortalItemTotal } from '#shared/types/portal-rows';
import { Button } from '~/components/ui/button';
import { useCartStore } from '~/stores/cart';
import {
  getOrderStatusLabel,
  getOrderStatusPillClass,
} from '~/utils/order-status';
import { reorderLines } from '~/utils/reorder';
import { productPath } from '#shared/utils/route-helpers';
import { replayLineHref } from '~/utils/configurator-replay';
import {
  orderAmounts,
  orderPaymentLabel,
  orderRows,
  orderTotalRows,
} from '~/utils/order-view';

definePageMeta({
  middleware: ['auth', 'feature'],
  feature: 'orderHistory',
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { localePath } = useLocaleMarket();
const { formatLocale } = useFormatLocale();
const cartStore = useCartStore();
const { isCatalogMode, timezone } = useTenant();
const { canAccess, pageTypeOf } = useFeatureAccess();
// What the button would add, so an order of configured rows offers no button
// that adds nothing.
const reorder = computed(() =>
  reorderLines(order.value?.cart?.items ?? [], pageTypeOf),
);
const canReorder = computed(
  () =>
    canAccess('reorder') &&
    !isCatalogMode.value &&
    reorder.value.lines.length > 0,
);

const isReordering = ref(false);

async function handleReorder() {
  const { lines, skipped } = reorder.value;
  if (!lines.length) return;

  isReordering.value = true;
  try {
    await cartStore.addItems(lines, skipped);
  } finally {
    isReordering.value = false;
  }
}

const orderId = computed(() => route.params.id as string);

const { data, error, pending } = useFetch<{ order: OrderDetailType }>(
  () => `/api/orders/${orderId.value}`,
  { dedupe: 'defer' },
);

const order = computed(() => data.value?.order);

/**
 * Arriving from the confirmation page before the platform has the order.
 *
 * `?awaiting=<publicId>` is set by that link. With it, a miss is a wait rather
 * than a 404: the order is polled until readable, bounded, with the existing
 * spinner on screen. Without it — a typed or bookmarked URL — a miss is the
 * 404 it always was.
 */
const awaiting = computed(() => route.query.awaiting === orderId.value);

/**
 * `replace`, and the path is unchanged, so this rewrites the address without a
 * navigation step. Dropped once the order is on screen, so a reload starts no
 * new wait.
 */
async function clearAwaitingParam() {
  if (!route.query.awaiting) return;
  const { awaiting: _dropped, ...rest } = route.query;
  await router.replace({ query: rest });
}

// Whichever response brought the order, the first one included.
watch(
  order,
  async (current) => {
    if (!import.meta.client || !current) return;
    await nextTick();
    await clearAwaitingParam();
  },
  { immediate: true },
);

const gaveUp = ref(false);

useAwaitedOrder<{ order: OrderDetailType }>({
  url: () => (awaiting.value ? `/api/orders/${orderId.value}` : null),
  settled: () => !pending.value,
  hasOrder: () => !!order.value,
  onOrder: (fresh) => {
    data.value = fresh;
  },
  // No 404 at the bound: the order was just placed, so it says it is slow and
  // keeps `awaiting`, so a reload waits again.
  onGiveUp: () => {
    gaveUp.value = true;
  },
});

const itemCount = computed(() => order.value?.cart?.items?.length ?? 0);

// Every amount is the side of the buyer's VAT choice; VAT itself is one number.
const { showIncVat } = useVatDisplay();

const amounts = computed(() =>
  orderAmounts(order.value, showIncVat.value, formatLocale.value),
);

useHead({
  title: computed(
    () =>
      `${t('portal.orders.detail.title')} #${order.value?.id ?? orderId.value}`,
  ),
});

// Handle 404 when order not found
const errorShown = ref(false);

function showNotFound() {
  if (errorShown.value) return;
  errorShown.value = true;
  showError(
    createError({
      statusCode: 404,
      statusMessage: 'Order not found',
    }),
  );
}

watch(
  [pending, error, data],
  () => {
    if (awaiting.value) return;
    // On the order, not on `error`: an order the wait brought in leaves the
    // first response's 404 behind.
    if (!pending.value && !data.value?.order) showNotFound();
  },
  { immediate: true },
);

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(formatLocale.value, {
    ...(timezone.value ? { timeZone: timezone.value } : {}),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * A configured row's product page, with that row's choices replayed from the
 * order. The canonical path, never the alias: the page's redirect to its
 * canonical drops the query, and with it the replay.
 */
function replayHref(
  canonical: string | null | undefined,
  row: number,
): string | undefined {
  if (!canonical) return undefined;
  return replayLineHref(localePath(productPath(canonical)), {
    publicOrderId: orderId.value,
    row,
  });
}

// One set of rows for the desktop table and the mobile sheet.
const orderItemRows = computed<PortalItemRow[]>(() =>
  orderRows(order.value, showIncVat.value, replayHref),
);

const orderTotals = computed<PortalItemTotal[]>(() =>
  orderTotalRows(
    amounts.value,
    itemCount.value,
    showIncVat.value,
    (key, named) => t(key, named ?? {}),
    t('common.total_inc_vat'),
  ),
);
</script>

<template>
  <PortalShell>
    <!-- Loading -->
    <div
      v-if="pending || (awaiting && !order && !gaveUp)"
      role="status"
      data-testid="order-loading"
      class="text-muted-foreground flex flex-col items-center justify-center gap-3 py-16"
    >
      <LoaderCircle class="size-8 animate-spin" aria-hidden="true" />
      <p v-if="awaiting" class="text-sm">{{ t('common.fetching_order') }}</p>
    </div>

    <!-- Waited to the bound: slow, not missing -->
    <div
      v-else-if="awaiting && !order"
      role="status"
      data-testid="order-slow"
      class="flex flex-col items-center gap-4 py-16 text-center"
    >
      <p class="text-muted-foreground text-sm">
        {{ t('portal.orders.detail.order_slow') }}
      </p>
      <NuxtLink
        :to="localePath('/portal/orders')"
        data-testid="back-link"
        class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft class="size-4" />
        {{ t('portal.orders.detail.back_to_orders') }}
      </NuxtLink>
    </div>

    <!-- Detail View -->
    <div v-else-if="order" data-testid="order-detail" class="space-y-6">
      <div class="border-border rounded-lg border bg-white p-6">
        <!-- Action Toolbar: back link left, action buttons right -->
        <div
          data-testid="order-action-toolbar"
          class="border-border flex flex-wrap items-center justify-between gap-4 border-b pb-4"
        >
          <NuxtLink
            :to="localePath('/portal/orders')"
            data-testid="back-link"
            class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft class="size-4" />
            {{ t('portal.orders.detail.back_to_orders') }}
          </NuxtLink>
          <div class="flex flex-wrap items-center gap-2">
            <Button
              v-if="canReorder"
              data-testid="reorder-button"
              :disabled="isReordering"
              @click="handleReorder"
            >
              <LoaderCircle v-if="isReordering" class="size-4 animate-spin" />
              <RotateCw v-else class="size-4" />
              {{ t('portal.orders.detail.actions.reorder') }}
            </Button>
          </div>
        </div>

        <!-- Two-column layout — order header lives at the top of the
             right column, above the summary box -->
        <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- Left: Order Items Table (desktop only; mobile uses the sheet) -->
          <div class="hidden lg:col-span-2 lg:block">
            <OrderItemsTable
              :items="orderItemRows"
              :amounts="amounts"
              :item-count="itemCount"
              :total-inc-vat-label="t('common.total_inc_vat')"
            />
          </div>

          <!-- Right: Order header + Summary + Addresses -->
          <div class="space-y-6">
            <!-- Order header: title, date subtitle, status badge right -->
            <div
              data-testid="order-header"
              class="flex flex-wrap items-start justify-between gap-3"
            >
              <div>
                <h2 class="text-2xl font-semibold">
                  {{ t('portal.orders.detail.title') }} {{ order?.id }}
                </h2>
                <p class="text-muted-foreground mt-1 text-sm">
                  {{ formatDate(order?.createdAt) }}
                </p>
              </div>
              <span
                v-if="order?.status"
                data-testid="status-badge"
                class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                :class="getOrderStatusPillClass(order?.status)"
              >
                {{ getOrderStatusLabel(order?.status, t) }}
              </span>
            </div>

            <!-- Summary Card -->
            <OrderSummaryCard
              :amounts="amounts"
              :item-count="itemCount"
              :total-inc-vat-label="t('common.total_inc_vat')"
            />

            <!-- Mobile: the broken desktop table is replaced by a sheet
                 opened from a "View order rows" trigger below the summary. -->
            <PortalItemRowsSheet
              class="lg:hidden"
              :items="orderItemRows"
              :totals="orderTotals"
              :trigger-label="t('portal.orders.detail.view_rows')"
              :title="t('portal.orders.detail.items.title')"
            />

            <!-- Addresses: share one grey container per Figma 25361-102134.
                 Section headers dark not uppercase, company line muted. -->
            <OrderAddresses
              :billing-address="order?.billingAddress"
              :shipping-address="order?.shippingAddress"
              :customer-order-number="order?.customerOrderNumber"
              :goods-label="order?.goodsLabel"
              :desired-delivery-date="order?.desiredDeliveryDate"
              :payment-method="order && orderPaymentLabel(order)"
            />

            <!-- Order message: shown only when the order carries one. Grey
                 box matching the summary and address cards. -->
            <div
              v-if="order?.message"
              data-testid="order-message"
              class="bg-muted space-y-1 rounded-lg p-6"
            >
              <p class="text-foreground text-sm font-semibold">
                {{ t('portal.orders.detail.order_message') }}
              </p>
              <p class="text-muted-foreground text-sm whitespace-pre-line">
                {{ order?.message }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PortalShell>
</template>
