<script setup lang="ts">
import type { AddressType, OrderSummaryType } from '#shared/types/commerce';
import type { QuoteAddress } from '#shared/types/quote';
import { Button } from '~/components/ui/button';
import { useCartStore } from '~/stores/cart';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const route = useRoute();
const { localePath } = useLocaleMarket();
const cartStore = useCartStore();

const isReordering = ref(false);

async function handleReorder() {
  const items = order.value?.cart?.items;
  if (!items?.length) return;

  isReordering.value = true;
  try {
    for (const item of items) {
      if (!item?.skuId) continue;
      await cartStore.addItem(item.skuId, item.quantity ?? 1);
    }
    navigateTo(localePath('/cart'));
  } finally {
    isReordering.value = false;
  }
}

const orderId = computed(() => route.params.id as string);

const { data, error, pending } = useFetch<{ order: OrderSummaryType }>(
  () => `/api/orders/${orderId.value}`,
  { dedupe: 'defer' },
);

const order = computed(() => data.value?.order);

function mapAddress(
  a: AddressType | null | undefined,
): QuoteAddress | undefined {
  if (!a) return undefined;
  return {
    company: a.company ?? undefined,
    firstName: a.firstName ?? undefined,
    lastName: a.lastName ?? undefined,
    addressLine1: a.addressLine1 ?? undefined,
    addressLine2: a.addressLine2 ?? undefined,
    addressLine3: a.addressLine3 ?? undefined,
    zip: a.zip ?? undefined,
    city: a.city ?? undefined,
    country: a.country ?? undefined,
    phone: a.phone ?? a.mobile ?? undefined,
  };
}

const billingAddress = computed<QuoteAddress | undefined>(() =>
  mapAddress(order.value?.billingAddress),
);

const shippingAddress = computed<QuoteAddress | undefined>(() =>
  mapAddress(order.value?.shippingAddress),
);

useHead({
  title: computed(() => `${t('portal.orders.detail.title')} #${orderId.value}`),
});

// Handle 404 when order not found
const errorShown = ref(false);
watch(
  [pending, error, data],
  () => {
    if (
      !errorShown.value &&
      !pending.value &&
      (error.value || !data.value?.order)
    ) {
      errorShown.value = true;
      showError(
        createError({
          statusCode: 404,
          statusMessage: 'Order not found',
        }),
      );
    }
  },
  { immediate: true },
);

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function statusBadgeClass(status?: string): string {
  switch (status) {
    case 'placed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'processing':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'shipped':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'delivered':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
</script>

<template>
  <PortalShell>
    <!-- Loading -->
    <div
      v-if="pending"
      data-testid="order-loading"
      class="flex items-center justify-center py-16"
    >
      <Icon
        name="lucide:loader-circle"
        class="text-muted-foreground size-8 animate-spin"
      />
    </div>

    <!-- Detail View -->
    <div v-else-if="order" data-testid="order-detail" class="space-y-6">
      <!-- Back link row -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <NuxtLink
          :to="localePath('/portal/orders')"
          data-testid="back-link"
          class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <Icon name="lucide:arrow-left" class="size-4" />
          {{ t('portal.orders.detail.back_to_orders') }}
        </NuxtLink>
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold">
            {{ t('portal.orders.detail.title') }} {{ order?.publicId }}
          </h2>
          <span class="text-muted-foreground text-sm">
            {{ formatDate(order?.createdAt) }}
          </span>
          <span
            v-if="order?.status"
            data-testid="status-badge"
            class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            :class="statusBadgeClass(order?.status)"
          >
            {{ t(`portal.orders.status.${order?.status}`) }}
          </span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div data-testid="action-buttons" class="flex flex-wrap gap-2">
        <Button variant="outline">
          {{ t('portal.orders.detail.actions.new_order_same_data') }}
        </Button>
        <Button variant="outline">
          {{ t('portal.orders.detail.actions.download_invoice') }}
        </Button>
        <Button variant="outline">
          {{ t('portal.orders.detail.actions.other_communication') }}
        </Button>
        <Button
          data-testid="reorder-button"
          class="bg-green-600 text-white hover:bg-green-700"
          :disabled="isReordering"
          @click="handleReorder"
        >
          <Icon
            v-if="isReordering"
            name="lucide:loader-circle"
            class="size-4 animate-spin"
          />
          {{ t('portal.orders.detail.actions.reorder') }}
        </Button>
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Left: Order Items Table -->
        <div class="lg:col-span-2">
          <h3 class="mb-3 text-base font-semibold">
            {{ t('portal.orders.detail.items.title') }}
          </h3>
          <div class="border-border rounded-lg border">
            <table data-testid="order-items-table" class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr>
                  <th class="px-4 py-3 text-left font-medium">
                    {{ t('portal.orders.detail.items.product') }}
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    {{ t('portal.orders.detail.items.article_number') }}
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    {{ t('portal.orders.detail.items.quantity') }}
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    {{ t('portal.orders.detail.items.unit_price') }}
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    {{ t('portal.orders.detail.items.total') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-border divide-y">
                <tr
                  v-for="item in order?.cart?.items"
                  :key="item?.skuId"
                  data-testid="order-item-row"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <ProductThumbnail
                        :file-name="
                          item?.product?.productImages?.[0]?.fileName ?? null
                        "
                        :alt="item?.product?.name ?? ''"
                      />
                      <span class="font-medium">{{ item?.product?.name }}</span>
                    </div>
                  </td>
                  <td class="text-muted-foreground px-4 py-3">
                    {{ item?.product?.articleNumber }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    {{ item?.quantity }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    {{ item?.unitPrice?.sellingPriceIncVatFormatted }}
                  </td>
                  <td class="px-4 py-3 text-right font-medium">
                    {{ item?.totalPrice?.sellingPriceIncVatFormatted }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right: Summary Sidebar -->
        <div class="space-y-4">
          <!-- Summary Card -->
          <div
            data-testid="order-summary"
            class="border-border rounded-lg border p-4"
          >
            <h3 class="mb-3 text-base font-semibold">
              {{ t('portal.orders.detail.summary.title') }}
            </h3>
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{
                  t('portal.orders.detail.summary.subtotal')
                }}</span>
                <span>{{
                  order?.cart?.summary?.subTotal?.sellingPriceIncVatFormatted
                }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{
                  t('portal.orders.detail.summary.shipping')
                }}</span>
                <span>{{
                  order?.cart?.summary?.shipping?.feeIncVatFormatted
                }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{
                  t('portal.orders.detail.summary.tax')
                }}</span>
                <span>{{
                  order?.cart?.summary?.total?.vatFormatted ??
                  order?.vat?.sellingPriceIncVatFormatted
                }}</span>
              </div>
              <div
                class="border-border mt-2 flex justify-between border-t pt-2 font-semibold"
              >
                <span>{{ t('portal.orders.detail.summary.total') }}</span>
                <span>{{
                  order?.cart?.summary?.total?.sellingPriceIncVatFormatted ??
                  order?.orderTotal?.sellingPriceIncVatFormatted
                }}</span>
              </div>
            </div>
          </div>

          <!-- Billing Address -->
          <AddressBlock
            v-if="billingAddress"
            data-testid="billing-address"
            :label="t('portal.orders.detail.billing_address')"
            :address="billingAddress"
          />

          <!-- Shipping Address -->
          <AddressBlock
            v-if="shippingAddress"
            data-testid="shipping-address"
            :label="t('portal.orders.detail.shipping_address')"
            :address="shippingAddress"
          />
        </div>
      </div>
    </div>
  </PortalShell>
</template>
