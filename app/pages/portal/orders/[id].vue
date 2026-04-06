<script setup lang="ts">
import type { OrderSummaryType } from '#shared/types/commerce';
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
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <NuxtLink
            :to="localePath('/portal/orders')"
            data-testid="back-link"
            class="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
          >
            <Icon name="lucide:arrow-left" class="size-4" />
            {{ t('portal.orders.detail.back_to_orders') }}
          </NuxtLink>
          <h2 class="text-2xl font-semibold">
            {{ t('portal.orders.detail.title') }} #{{ order?.publicId }}
          </h2>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ formatDate(order?.createdAt) }}
          </p>
        </div>
        <span
          v-if="order?.status"
          data-testid="status-badge"
          class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          :class="statusBadgeClass(order?.status)"
        >
          {{ t(`portal.orders.status.${order?.status}`) }}
        </span>
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
                      <div class="size-10 shrink-0 overflow-hidden rounded">
                        <GeinsImage
                          v-if="item?.product?.productImages?.[0]?.fileName"
                          :file-name="
                            item?.product?.productImages?.[0]?.fileName
                          "
                          type="product"
                          :alt="item?.product?.name ?? ''"
                          aspect-ratio="1"
                          sizes="40px"
                        />
                        <div
                          v-else
                          class="bg-muted flex size-full items-center justify-center"
                        >
                          <Icon
                            name="lucide:image-off"
                            class="text-muted-foreground size-4"
                          />
                        </div>
                      </div>
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
            class="border-border space-y-2 rounded-lg border p-4"
          >
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

          <!-- Billing Address -->
          <div
            v-if="order?.billingAddress"
            data-testid="billing-address"
            class="border-border space-y-1 rounded-lg border p-4"
          >
            <p
              class="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase"
            >
              {{ t('portal.orders.detail.billing_address') }}
            </p>
            <p
              v-if="order?.billingAddress?.company"
              class="text-sm font-medium"
            >
              {{ order?.billingAddress?.company }}
            </p>
            <p
              v-if="
                order?.billingAddress?.firstName ||
                order?.billingAddress?.lastName
              "
              class="text-sm"
            >
              {{ order?.billingAddress?.firstName }}
              {{ order?.billingAddress?.lastName }}
            </p>
            <p v-if="order?.billingAddress?.addressLine1" class="text-sm">
              {{ order?.billingAddress?.addressLine1 }}
            </p>
            <p v-if="order?.billingAddress?.addressLine2" class="text-sm">
              {{ order?.billingAddress?.addressLine2 }}
            </p>
            <p v-if="order?.billingAddress?.addressLine3" class="text-sm">
              {{ order?.billingAddress?.addressLine3 }}
            </p>
            <p
              v-if="order?.billingAddress?.zip || order?.billingAddress?.city"
              class="text-sm"
            >
              {{ order?.billingAddress?.zip }}
              {{ order?.billingAddress?.city }}
            </p>
            <p v-if="order?.billingAddress?.country" class="text-sm">
              {{ order?.billingAddress?.country }}
            </p>
            <p
              v-if="order?.billingAddress?.phone"
              class="text-muted-foreground text-sm"
            >
              {{ order?.billingAddress?.phone }}
            </p>
            <p
              v-if="order?.billingAddress?.mobile"
              class="text-muted-foreground text-sm"
            >
              {{ order?.billingAddress?.mobile }}
            </p>
          </div>

          <!-- Shipping Address -->
          <div
            v-if="order?.shippingAddress"
            data-testid="shipping-address"
            class="border-border space-y-1 rounded-lg border p-4"
          >
            <p
              class="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase"
            >
              {{ t('portal.orders.detail.shipping_address') }}
            </p>
            <p
              v-if="order?.shippingAddress?.company"
              class="text-sm font-medium"
            >
              {{ order?.shippingAddress?.company }}
            </p>
            <p
              v-if="
                order?.shippingAddress?.firstName ||
                order?.shippingAddress?.lastName
              "
              class="text-sm"
            >
              {{ order?.shippingAddress?.firstName }}
              {{ order?.shippingAddress?.lastName }}
            </p>
            <p v-if="order?.shippingAddress?.addressLine1" class="text-sm">
              {{ order?.shippingAddress?.addressLine1 }}
            </p>
            <p v-if="order?.shippingAddress?.addressLine2" class="text-sm">
              {{ order?.shippingAddress?.addressLine2 }}
            </p>
            <p v-if="order?.shippingAddress?.addressLine3" class="text-sm">
              {{ order?.shippingAddress?.addressLine3 }}
            </p>
            <p
              v-if="order?.shippingAddress?.zip || order?.shippingAddress?.city"
              class="text-sm"
            >
              {{ order?.shippingAddress?.zip }}
              {{ order?.shippingAddress?.city }}
            </p>
            <p v-if="order?.shippingAddress?.country" class="text-sm">
              {{ order?.shippingAddress?.country }}
            </p>
            <p
              v-if="order?.shippingAddress?.phone"
              class="text-muted-foreground text-sm"
            >
              {{ order?.shippingAddress?.phone }}
            </p>
            <p
              v-if="order?.shippingAddress?.mobile"
              class="text-muted-foreground text-sm"
            >
              {{ order?.shippingAddress?.mobile }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </PortalShell>
</template>
