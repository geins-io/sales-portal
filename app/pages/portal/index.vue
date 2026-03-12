<script setup lang="ts">
import { useQuotesStore } from '~/stores/quotes';

definePageMeta({
  middleware: 'auth',
});

const { t } = useI18n();

const { data: ordersData, pending: ordersPending } = useFetch<{
  orders: Array<{
    id?: number | null;
    status: string;
    createdAt?: string | null;
    billingAddress?: { firstName?: string; lastName?: string } | null;
    cart?: {
      items?: Array<{ product?: { productId?: number } | null } | null> | null;
      summary?: {
        total?: {
          sellingPriceIncVat?: number;
          sellingPriceIncVatFormatted?: string;
        } | null;
      } | null;
    } | null;
  }>;
}>('/api/user/orders', { dedupe: 'defer' });

const orders = computed(() => ordersData.value?.orders ?? []);
const orderCount = computed(() => orders.value.length);
const purchasedProductIds = computed(() => {
  const ids = new Set<number>();
  for (const order of orders.value) {
    for (const item of order.cart?.items ?? []) {
      if (item?.product?.productId) {
        ids.add(item.product.productId);
      }
    }
  }
  return ids;
});
const purchasedProductCount = computed(() => purchasedProductIds.value.size);

const quotesStore = useQuotesStore();
const recentPendingQuotes = computed(() =>
  quotesStore.pendingQuotes.slice(0, 3),
);

onMounted(() => {
  quotesStore.fetchQuotes();
});
</script>

<template>
  <PortalShell>
    <!-- Stat Cards -->
    <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <PortalStatCard
        icon="lucide:file-text"
        :count="quotesStore.pendingCount"
        :label="t('portal.overview.stat.pending_quotations')"
        :show-dot="quotesStore.pendingCount > 0"
      />
      <PortalStatCard
        icon="lucide:shopping-bag"
        :count="orderCount"
        :label="t('portal.overview.stat.orders_placed')"
      />
      <PortalStatCard
        icon="lucide:package"
        :count="purchasedProductCount"
        :label="t('portal.overview.stat.purchased_products')"
      />
      <PortalStatCard
        icon="lucide:users"
        :count="0"
        :label="t('portal.overview.stat.persons_in_org')"
      />
    </div>

    <!-- Latest Orders -->
    <div class="mb-8">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ t('portal.overview.latest_orders') }}
        </h3>
        <NuxtLink
          to="/portal/orders"
          class="text-primary hover:text-primary/80 text-sm font-medium"
        >
          {{ t('portal.overview.view_all') }}
        </NuxtLink>
      </div>
      <p class="text-muted-foreground mb-4 text-sm">
        {{ t('portal.overview.read_write_description') }}
      </p>
      <div
        v-if="ordersPending"
        class="text-muted-foreground py-8 text-center text-sm"
      >
        Loading...
      </div>
      <PortalOrdersTable v-else :orders="orders" :limit="5" />
    </div>

    <!-- Pending Quotations & Your Lists -->
    <div class="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold">
            {{ t('portal.overview.pending_quotations') }}
          </h3>
          <NuxtLink
            to="/portal/quotations"
            class="text-primary hover:text-primary/80 text-sm font-medium"
          >
            {{ t('portal.overview.view_all') }}
          </NuxtLink>
        </div>
        <p
          v-if="recentPendingQuotes.length === 0"
          data-testid="pending-quotations-empty"
          class="text-muted-foreground text-sm"
        >
          {{ t('portal.overview.no_quotations') }}
        </p>
        <ul v-else class="divide-border divide-y">
          <li
            v-for="quote in recentPendingQuotes"
            :key="quote.id"
            data-testid="pending-quote-row"
            class="flex items-center justify-between py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">
                {{ quote.quoteNumber }}
              </p>
              <p class="text-muted-foreground truncate text-xs">
                {{ quote.contactName }}
              </p>
            </div>
            <span class="text-sm font-medium">{{ quote.totalFormatted }}</span>
          </li>
        </ul>
      </div>
      <div>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold">
            {{ t('portal.overview.your_lists') }}
          </h3>
          <NuxtLink
            to="/portal/lists"
            class="text-primary hover:text-primary/80 text-sm font-medium"
          >
            {{ t('portal.overview.view_all') }}
          </NuxtLink>
        </div>
        <p class="text-muted-foreground text-sm">
          {{ t('portal.overview.no_lists') }}
        </p>
      </div>
    </div>

    <!-- Purchased Products -->
    <div>
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ t('portal.overview.purchased_products') }}
        </h3>
        <NuxtLink
          to="/portal/products"
          class="text-primary hover:text-primary/80 text-sm font-medium"
        >
          {{ t('portal.overview.view_all') }}
        </NuxtLink>
      </div>
      <p class="text-muted-foreground text-sm">
        {{ t('portal.overview.no_products') }}
      </p>
    </div>
  </PortalShell>
</template>
