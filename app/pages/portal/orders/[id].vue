<script setup lang="ts">
import {
  ArrowLeft,
  LoaderCircle,
  MessageSquare,
  RotateCw,
} from 'lucide-vue-next';
import type { AddressType, OrderSummaryType } from '#shared/types/commerce';
import type { QuoteAddress } from '#shared/types/quote';
import { Button } from '~/components/ui/button';
import { useCartStore } from '~/stores/cart';
import { getOrderStatusPillClass } from '~/utils/order-status';
import { productPath } from '#shared/utils/route-helpers';

definePageMeta({
  middleware: ['auth', 'feature'],
  feature: 'orderHistory',
});

const { t } = useI18n();
const route = useRoute();
const { localePath } = useLocaleMarket();
const cartStore = useCartStore();
const { isCatalogMode } = useTenant();
const { canAccess } = useFeatureAccess();
const canReorder = computed(() => canAccess('reorder') && !isCatalogMode.value);

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

const itemCount = computed(() => order.value?.cart?.items?.length ?? 0);

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
  title: computed(
    () =>
      `${t('portal.orders.detail.title')} #${order.value?.id ?? orderId.value}`,
  ),
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
</script>

<template>
  <PortalShell>
    <!-- Loading -->
    <div
      v-if="pending"
      data-testid="order-loading"
      class="flex items-center justify-center py-16"
    >
      <LoaderCircle class="text-muted-foreground size-8 animate-spin" />
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
              data-testid="order-communication-button"
              variant="secondary"
            >
              <MessageSquare class="size-4" />
              {{ t('portal.orders.detail.actions.order_communication') }}
            </Button>
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
                    <td class="h-24 px-4 py-2">
                      <div class="flex items-center gap-3">
                        <ProductThumbnail
                          :file-name="
                            item?.product?.productImages?.[0]?.fileName ?? null
                          "
                          :alt="item?.product?.name ?? ''"
                        />
                        <NuxtLink
                          v-if="item?.product?.alias"
                          :to="localePath(productPath(item.product.alias))"
                          data-testid="order-item-name-link"
                          class="font-medium hover:underline"
                        >
                          {{ item?.product?.name }}
                        </NuxtLink>
                        <span
                          v-else
                          data-testid="order-item-name"
                          class="font-medium"
                          >{{ item?.product?.name }}</span
                        >
                      </div>
                    </td>
                    <td class="text-muted-foreground h-24 px-4 py-2">
                      {{ item?.product?.articleNumber }}
                    </td>
                    <td class="h-24 px-4 py-2 text-right">
                      {{ item?.quantity }}
                    </td>
                    <td class="h-24 px-4 py-2 text-right">
                      {{ item?.unitPrice?.sellingPriceIncVatFormatted }}
                    </td>
                    <td class="px-4 py-5 text-right font-medium">
                      {{ item?.totalPrice?.sellingPriceIncVatFormatted }}
                    </td>
                  </tr>
                </tbody>
                <tfoot
                  data-testid="order-items-footer"
                  class="border-border border-t"
                >
                  <tr>
                    <td
                      colspan="4"
                      class="text-muted-foreground px-4 py-3 text-right text-sm"
                    >
                      {{
                        t('portal.orders.detail.summary.subtotal_with_count', {
                          count: itemCount,
                        })
                      }}
                    </td>
                    <td class="px-4 py-3 text-right text-sm">
                      {{
                        order?.cart?.summary?.subTotal
                          ?.sellingPriceIncVatFormatted
                      }}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colspan="4"
                      class="text-muted-foreground px-4 py-3 text-right text-sm"
                    >
                      {{ t('portal.orders.detail.summary.shipping') }}
                    </td>
                    <td class="px-4 py-3 text-right text-sm">
                      {{ order?.cart?.summary?.shipping?.feeIncVatFormatted }}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colspan="4"
                      class="text-muted-foreground px-4 py-3 text-right text-sm"
                    >
                      {{ t('portal.orders.detail.summary.tax') }}
                    </td>
                    <td class="px-4 py-3 text-right text-sm">
                      {{
                        order?.cart?.summary?.total?.vatFormatted ??
                        order?.vat?.sellingPriceIncVatFormatted
                      }}
                    </td>
                  </tr>
                  <tr class="border-border border-t">
                    <td
                      colspan="4"
                      class="px-4 py-5 text-right text-sm font-semibold"
                    >
                      {{ t('portal.orders.detail.summary.total') }}
                    </td>
                    <td class="px-4 py-5 text-right text-sm font-semibold">
                      {{
                        order?.cart?.summary?.total
                          ?.sellingPriceIncVatFormatted ??
                        order?.orderTotal?.sellingPriceIncVatFormatted
                      }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
                {{ t(`portal.orders.status.${order?.status}`) }}
              </span>
            </div>

            <!-- Summary Card -->
            <div data-testid="order-summary" class="bg-muted rounded-lg p-6">
              <h3 class="mb-4 text-base font-semibold">
                {{ t('portal.orders.detail.summary.title') }}
              </h3>
              <div class="space-y-3.5">
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">{{
                    t('portal.orders.detail.summary.subtotal_with_count', {
                      count: itemCount,
                    })
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
                  class="border-border mt-2 flex justify-between border-t pt-4 font-semibold"
                >
                  <span>{{ t('portal.orders.detail.summary.total') }}</span>
                  <span>{{
                    order?.cart?.summary?.total?.sellingPriceIncVatFormatted ??
                    order?.orderTotal?.sellingPriceIncVatFormatted
                  }}</span>
                </div>
              </div>
            </div>

            <!-- Addresses: share one grey container per Figma 25361-102134.
                 Section headers dark not uppercase, company line muted. -->
            <div
              v-if="billingAddress || shippingAddress"
              class="bg-muted space-y-4 rounded-lg p-6"
            >
              <AddressBlock
                v-if="billingAddress"
                bare
                label-style="header"
                company-muted
                data-testid="billing-address"
                :label="t('portal.orders.detail.billing_address')"
                :address="billingAddress"
              />
              <hr
                v-if="billingAddress && shippingAddress"
                class="border-border"
              />
              <AddressBlock
                v-if="shippingAddress"
                bare
                label-style="header"
                company-muted
                data-testid="shipping-address"
                :label="t('portal.orders.detail.shipping_address')"
                :address="shippingAddress"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </PortalShell>
</template>
