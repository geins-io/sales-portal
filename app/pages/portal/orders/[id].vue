<script setup lang="ts">
import { ArrowLeft, LoaderCircle, RotateCw } from 'lucide-vue-next';
import type { AddressType, OrderDetailType } from '#shared/types/commerce';
import type { QuoteAddress } from '#shared/types/quote';
import type { PortalItemRow, PortalItemTotal } from '#shared/types/portal-rows';
import { Button } from '~/components/ui/button';
import { useCartStore } from '~/stores/cart';
import { getOrderStatusPillClass } from '~/utils/order-status';
import { reorderLines } from '~/utils/reorder';
import { productPath } from '#shared/utils/route-helpers';
import { replayLineHref } from '~/utils/configurator-replay';

definePageMeta({
  middleware: ['auth', 'feature'],
  feature: 'orderHistory',
});

const { t } = useI18n();
const route = useRoute();
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
    order.value?.reorderable === true &&
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
  return new Date(iso).toLocaleDateString(formatLocale.value, {
    ...(timezone.value ? { timeZone: timezone.value } : {}),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const hasAdditionalInfo = computed(
  () =>
    !!(
      order.value?.customerOrderNumber ||
      order.value?.goodsLabel ||
      order.value?.desiredDeliveryDate
    ),
);

// Slices the YYYY-MM-DD portion from the ISO date string rather than using
// toLocaleDateString, which would shift a pure calendar date under negative
// UTC offsets.
const deliveryDate = computed(() => {
  const raw = order.value?.desiredDeliveryDate;
  if (!raw) return '';
  const match = /^\d{4}-\d{2}-\d{2}/.exec(raw);
  return match ? match[0] : raw;
});

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

// Normalised line items + totals for the mobile rows sheet (the desktop table
// does not work on small screens).
const orderItemRows = computed<PortalItemRow[]>(() =>
  (order.value?.cart?.items ?? []).map((item, index) => ({
    // By position: two rows of an order can carry one SKU.
    key: `row-${index}`,
    name: item?.product?.name ?? '',
    articleNumber: item?.product?.articleNumber ?? undefined,
    quantity: item?.quantity ?? 0,
    unitPriceFormatted:
      item?.unitPrice?.sellingPriceIncVatFormatted ?? undefined,
    totalPriceFormatted:
      item?.totalPrice?.sellingPriceIncVatFormatted ?? undefined,
    imageFileName: item?.product?.productImages?.[0]?.fileName ?? null,
    alias: item?.product?.alias ?? null,
    href: item?.configuration
      ? replayHref(item.product?.canonicalUrl, index)
      : undefined,
    configuration: item?.configuration,
    unitPrice: item?.unitPrice,
    totalPrice: item?.totalPrice,
  })),
);

const orderTotals = computed<PortalItemTotal[]>(() => [
  {
    label: t('portal.orders.detail.summary.subtotal_with_count', {
      count: itemCount.value,
    }),
    value:
      order.value?.cart?.summary?.subTotal?.sellingPriceIncVatFormatted ??
      undefined,
  },
  {
    label: t('portal.orders.detail.summary.shipping'),
    value:
      order.value?.cart?.summary?.shipping?.feeIncVatFormatted ?? undefined,
  },
  {
    label: t('portal.orders.detail.summary.tax'),
    value:
      order.value?.cart?.summary?.total?.vatFormatted ??
      order.value?.vat?.sellingPriceIncVatFormatted ??
      undefined,
  },
  {
    label: t('portal.orders.detail.summary.total'),
    value:
      order.value?.cart?.summary?.total?.sellingPriceIncVatFormatted ??
      order.value?.orderTotal?.sellingPriceIncVatFormatted ??
      undefined,
    emphasis: true,
  },
]);
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
                    v-for="(item, index) in order?.cart?.items"
                    :key="index"
                    :class="{ 'align-top': item?.configuration }"
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
                        <div>
                          <NuxtLink
                            v-if="item?.product?.alias"
                            :to="
                              (item.configuration &&
                                replayHref(item.product.canonicalUrl, index)) ||
                              localePath(productPath(item.product.alias))
                            "
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
                          <p
                            v-if="item?.configuration"
                            data-testid="order-item-configured"
                            class="text-muted-foreground text-xs"
                          >
                            {{ t('cart.configured_product') }}
                          </p>
                        </div>
                      </div>
                      <div v-if="item?.configuration" class="mt-2 pl-13">
                        <LineSpecification
                          :id="`order-item-configuration-${index}`"
                          :product-name="item.product?.name ?? ''"
                          :quantity="item.quantity ?? 1"
                          :configuration="item.configuration"
                          :unit-price="item.unitPrice"
                          :total-price="item.totalPrice"
                        />
                      </div>
                    </td>
                    <td
                      data-testid="order-item-article-number"
                      class="text-muted-foreground h-24 px-4 py-2"
                    >
                      {{ item?.product?.articleNumber }}
                    </td>
                    <td
                      data-testid="order-item-quantity"
                      class="h-24 px-4 py-2 text-right"
                    >
                      {{ item?.quantity }}
                    </td>
                    <td
                      data-testid="order-item-unit-price"
                      class="h-24 px-4 py-2 text-right"
                    >
                      {{ item?.unitPrice?.sellingPriceIncVatFormatted }}
                    </td>
                    <td
                      data-testid="order-item-total-price"
                      class="h-24 px-4 py-2 text-right font-medium"
                    >
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
                    <td
                      data-testid="order-items-footer-total"
                      class="px-4 py-5 text-right text-sm font-semibold"
                    >
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
                  <span data-testid="order-summary-subtotal">{{
                    order?.cart?.summary?.subTotal?.sellingPriceIncVatFormatted
                  }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">{{
                    t('portal.orders.detail.summary.shipping')
                  }}</span>
                  <span data-testid="order-summary-shipping">{{
                    order?.cart?.summary?.shipping?.feeIncVatFormatted
                  }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">{{
                    t('portal.orders.detail.summary.tax')
                  }}</span>
                  <span data-testid="order-summary-tax">{{
                    order?.cart?.summary?.total?.vatFormatted ??
                    order?.vat?.sellingPriceIncVatFormatted
                  }}</span>
                </div>
                <div
                  class="border-border mt-2 flex justify-between border-t pt-4 font-semibold"
                >
                  <span>{{ t('portal.orders.detail.summary.total') }}</span>
                  <span data-testid="order-summary-total">{{
                    order?.cart?.summary?.total?.sellingPriceIncVatFormatted ??
                    order?.orderTotal?.sellingPriceIncVatFormatted
                  }}</span>
                </div>
              </div>
            </div>

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
            <div
              v-if="billingAddress || shippingAddress || hasAdditionalInfo"
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
                v-if="billingAddress && (shippingAddress || hasAdditionalInfo)"
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
              <hr
                v-if="shippingAddress && hasAdditionalInfo"
                class="border-border"
              />
              <div
                v-if="hasAdditionalInfo"
                data-testid="order-additional-info"
                class="space-y-1"
              >
                <p class="text-foreground text-sm font-semibold">
                  {{ t('portal.orders.detail.additional_info.title') }}
                </p>
                <p
                  v-if="order?.customerOrderNumber"
                  data-testid="additional-your-reference"
                  class="text-muted-foreground text-sm"
                >
                  {{
                    t('portal.orders.detail.additional_info.your_reference')
                  }}: {{ order?.customerOrderNumber }}
                </p>
                <p
                  v-if="order?.goodsLabel"
                  data-testid="additional-goods-label"
                  class="text-muted-foreground text-sm"
                >
                  {{ t('portal.orders.detail.additional_info.goods_label') }}:
                  {{ order?.goodsLabel }}
                </p>
                <p
                  v-if="deliveryDate"
                  data-testid="additional-delivery-date"
                  class="text-muted-foreground text-sm"
                >
                  {{
                    t(
                      'portal.orders.detail.additional_info.desired_delivery_date',
                    )
                  }}: {{ deliveryDate }}
                </p>
              </div>
            </div>

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
