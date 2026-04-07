<script setup lang="ts">
import type { PurchasedProduct } from '#shared/types/commerce';
import type { SavedList } from '#shared/types/saved-list';
import type { QuoteStatus } from '#shared/types/quote';
import { Button } from '~/components/ui/button';
import { useQuotesStore } from '~/stores/quotes';

definePageMeta({
  middleware: 'auth',
});

const { t } = useI18n();
const { localePath } = useLocaleMarket();

// ---------------------------------------------------------------------------
// Orders data
// ---------------------------------------------------------------------------
const { data: ordersData, pending: ordersPending } = useFetch<{
  orders: Array<{
    id?: number | null;
    publicId?: string | null;
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

// ---------------------------------------------------------------------------
// Quotes data
// ---------------------------------------------------------------------------
const quotesStore = useQuotesStore();
const recentPendingQuotes = computed(() =>
  quotesStore.pendingQuotes.slice(0, 5),
);

// Use callOnce to fetch quotes — runs during SSR and skips on client hydration,
// avoiding hydration mismatch for pendingCount stat card.
callOnce('portal-quotes', () => quotesStore.fetchQuotes());

// ---------------------------------------------------------------------------
// Purchased products data
// ---------------------------------------------------------------------------
const { data: productsData, pending: productsPending } = useFetch<{
  products: PurchasedProduct[];
  total: number;
}>('/api/orders/products', { dedupe: 'defer' });

const recentProducts = computed(() =>
  (productsData.value?.products ?? []).slice(0, 4),
);

// ---------------------------------------------------------------------------
// Saved lists data
// ---------------------------------------------------------------------------
const { data: listsData, pending: listsPending } = useFetch<{
  lists: SavedList[];
  total: number;
}>('/api/lists', { dedupe: 'defer' });

const recentLists = computed(() => (listsData.value?.lists ?? []).slice(0, 5));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getStatusClasses(status: QuoteStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'accepted':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'expired':
    case 'cancelled':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getStatusLabel(status: QuoteStatus): string {
  return t(`portal.quotations.status_${status}`);
}

function getProductPrice(product: PurchasedProduct): string {
  return product.priceExVatFormatted ?? String(product.priceExVat ?? '-');
}
</script>

<template>
  <PortalShell>
    <!-- Stat Cards -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
    <div class="mb-6">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ t('portal.overview.latest_orders') }}
        </h3>
        <NuxtLink
          :to="localePath('/portal/orders')"
          class="text-primary hover:text-primary/80 text-sm font-medium"
        >
          {{ t('portal.overview.view_all') }}
        </NuxtLink>
      </div>
      <div
        v-if="ordersPending"
        class="text-muted-foreground py-8 text-center text-sm"
      >
        {{ t('common.loading') }}
      </div>
      <PortalOrdersTable v-else :orders="orders" :limit="5" />
    </div>

    <!-- Pending Quotations & Your Lists -->
    <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Pending Quotations mini-table -->
      <div class="border-border rounded-lg border p-4">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold">
            {{ t('portal.overview.pending_quotations') }}
          </h3>
          <NuxtLink
            :to="localePath('/portal/quotations')"
            class="text-primary hover:text-primary/80 text-sm font-medium"
          >
            {{ t('portal.overview.view_all') }}
          </NuxtLink>
        </div>
        <div class="overflow-x-auto">
          <table data-testid="pending-quotations-table" class="w-full text-sm">
            <thead>
              <tr class="border-border border-b text-left">
                <th class="py-3 pr-4 font-medium">
                  {{ t('portal.quotations.quote_number') }}
                </th>
                <th class="py-3 pr-4 font-medium">
                  {{ t('portal.quotations.created') }}
                </th>
                <th class="py-3 pr-4 font-medium">
                  {{ t('portal.quotations.status') }}
                </th>
                <th class="py-3 pr-4 font-medium">
                  {{ t('portal.quotations.total') }}
                </th>
                <th class="py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="recentPendingQuotes.length === 0">
                <td
                  colspan="5"
                  data-testid="pending-quotations-empty"
                  class="text-muted-foreground py-6 text-center text-sm"
                >
                  {{ t('portal.overview.no_quotations') }}
                </td>
              </tr>
              <tr
                v-for="quote in recentPendingQuotes"
                :key="quote.id"
                data-testid="pending-quote-row"
                class="border-border hover:bg-muted/50 border-b transition-colors"
              >
                <td class="py-3 pr-4 font-medium">
                  {{ quote.quoteNumber }}
                </td>
                <td class="py-3 pr-4">
                  {{ formatDate(quote.createdAt) }}
                </td>
                <td class="py-3 pr-4">
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    :class="getStatusClasses(quote.status)"
                  >
                    {{ getStatusLabel(quote.status) }}
                  </span>
                </td>
                <td class="py-3 pr-4">{{ quote.totalFormatted }}</td>
                <td class="py-3">
                  <NuxtLink
                    :to="localePath(`/portal/quotations/${quote.id}`)"
                    class="text-primary hover:text-primary/80 text-sm font-medium"
                  >
                    {{ t('portal.quotations.view') }}
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Your Lists mini-table -->
      <div class="border-border rounded-lg border p-4">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold">
            {{ t('portal.overview.your_lists') }}
          </h3>
          <NuxtLink
            :to="localePath('/portal/lists')"
            class="text-primary hover:text-primary/80 text-sm font-medium"
          >
            {{ t('portal.overview.view_all') }}
          </NuxtLink>
        </div>
        <div
          v-if="listsPending"
          class="text-muted-foreground py-8 text-center text-sm"
        >
          {{ t('common.loading') }}
        </div>
        <div v-else class="overflow-x-auto">
          <table data-testid="your-lists-table" class="w-full text-sm">
            <thead>
              <tr class="border-border border-b text-left">
                <th class="py-3 pr-4 font-medium">
                  {{ t('portal.saved_lists.columns.name') }}
                </th>
                <th class="py-3 pr-4 font-medium">
                  {{ t('portal.saved_lists.columns.modified') }}
                </th>
                <th class="py-3 pr-4 font-medium">
                  {{ t('portal.saved_lists.columns.products') }}
                </th>
                <th class="py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="recentLists.length === 0">
                <td
                  colspan="4"
                  data-testid="your-lists-empty"
                  class="text-muted-foreground py-6 text-center text-sm"
                >
                  {{ t('portal.overview.no_lists') }}
                </td>
              </tr>
              <tr
                v-for="list in recentLists"
                :key="list.id"
                data-testid="your-list-row"
                class="border-border hover:bg-muted/50 border-b transition-colors"
              >
                <td class="py-3 pr-4">{{ list.name }}</td>
                <td class="py-3 pr-4">{{ formatDate(list.updatedAt) }}</td>
                <td class="py-3 pr-4">{{ list.items?.length ?? 0 }}</td>
                <td class="py-3">
                  <NuxtLink
                    :to="localePath(`/portal/saved-lists/${list.id}`)"
                    class="text-primary hover:text-primary/80 text-sm font-medium"
                  >
                    {{ t('portal.quotations.view') }}
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Purchased Products -->
    <div>
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ t('portal.overview.purchased_products') }}
        </h3>
        <NuxtLink
          :to="localePath('/portal/products')"
          class="text-primary hover:text-primary/80 text-sm font-medium"
        >
          {{ t('portal.overview.view_all') }}
        </NuxtLink>
      </div>
      <div
        v-if="productsPending"
        class="text-muted-foreground py-8 text-center text-sm"
      >
        {{ t('common.loading') }}
      </div>
      <p
        v-else-if="recentProducts.length === 0"
        data-testid="purchased-products-empty"
        class="text-muted-foreground text-sm"
      >
        {{ t('portal.overview.no_products') }}
      </p>
      <div
        v-else
        data-testid="purchased-products-grid"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div
          v-for="product in recentProducts"
          :key="product.articleNumber"
          data-testid="purchased-product-card"
          class="border-border flex flex-col overflow-hidden rounded-lg border"
        >
          <!-- Product image placeholder -->
          <div class="bg-muted flex h-32 items-center justify-center">
            <Icon name="lucide:package" class="text-muted-foreground size-10" />
          </div>
          <!-- Product info -->
          <div class="flex flex-1 flex-col gap-2 p-3">
            <p class="truncate text-sm font-medium">
              {{ product.name }}
            </p>
            <p class="text-muted-foreground mt-auto text-sm">
              {{ getProductPrice(product) }}
            </p>
            <Button
              size="sm"
              class="mt-1 w-full text-xs"
              data-testid="product-add-to-cart"
            >
              <Icon name="lucide:shopping-cart" class="mr-1.5 size-3.5" />
              {{ t('portal.saved_list_detail.add_to_cart') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </PortalShell>
</template>
