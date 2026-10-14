<script setup lang="ts">
import type { OrderDetailType } from '#shared/types/commerce';
import type { PortalItemRow, PortalItemTotal } from '#shared/types/portal-rows';
import { productPath } from '#shared/utils/route-helpers';
import { replayLineHref } from '~/utils/configurator-replay';
import {
  orderAmounts,
  orderPaymentLabel,
  orderRows,
  orderTotalRows,
} from '~/utils/order-view';

definePageMeta({ layout: 'checkout' });

const { t } = useI18n();
const route = useRoute();
const { localePath } = useLocaleMarket();
const { formatLocale } = useFormatLocale();
const { showIncVat } = useVatDisplay();

useHead({
  title: computed(() => t('order_confirmation.title')),
});

function queryValue(name: string): string {
  const value = route.query[name];
  return typeof value === 'string' ? value : '';
}

// Two ways in:
// - In-app checkout:        ?orderId=<publicId>&orderNumber=<id>, put there by
//   checkout.vue. The order is read and shown.
// - Hosted checkout return: ?geins-cart=<cartId>. A hosted order returns with
//   nothing to read, so the page shows its thank-you header only.
const hosted = !!queryValue('geins-cart');
const publicOrderId = hosted ? '' : queryValue('orderId');
// Shown on the badge at once, before the order is readable.
const orderNumber = queryValue('orderNumber');

// The order the portal reads. Geins's checkout summary never carries an order
// placed through our own checkout, so it is not asked here.
const orderUrl = publicOrderId ? `/api/orders/${publicOrderId}` : null;
const { data: orderData, pending: orderPending } = useFetch<{
  order: OrderDetailType;
}>(`/api/orders/${publicOrderId}`, {
  dedupe: 'defer',
  immediate: !!orderUrl,
});
const order = computed(() => orderData.value?.order ?? null);

// The order is readable seconds after it was placed, so the page waits for it
// silently: the thank-you, number and link show at once, the rest fills in.
useAwaitedOrder<{ order: OrderDetailType }>({
  url: orderUrl,
  settled: () => !orderPending.value,
  hasOrder: () => !!order.value,
  onOrder: (fresh) => {
    orderData.value = fresh;
  },
});

// The order as the portal order page shows it, with the same parts.
const itemCount = computed(() => order.value?.cart?.items?.length ?? 0);
const amounts = computed(() =>
  orderAmounts(order.value, showIncVat.value, formatLocale.value),
);

/** A configured row's product page, with that row's choices replayed. */
function replayHref(
  canonical: string | null | undefined,
  row: number,
): string | undefined {
  if (!canonical) return undefined;
  return replayLineHref(localePath(productPath(canonical)), {
    publicOrderId,
    row,
  });
}

const rows = computed<PortalItemRow[]>(() =>
  orderRows(order.value, showIncVat.value, replayHref),
);
const totals = computed<PortalItemTotal[]>(() =>
  orderTotalRows(
    amounts.value,
    itemCount.value,
    showIncVat.value,
    (key, named) => t(key, named ?? {}),
    t('common.to_pay_inc_vat'),
  ),
);
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-6">
    <OrderConfirmation
      :order-number="orderNumber"
      :public-order-id="publicOrderId"
    >
      <div
        v-if="order"
        data-testid="confirmation-order"
        class="border-border mt-8 grid grid-cols-1 gap-6 rounded-lg border bg-white p-6 lg:grid-cols-3"
      >
        <!-- Left: rows (desktop only; mobile uses the sheet) -->
        <div class="hidden lg:col-span-2 lg:block">
          <OrderItemsTable
            :items="rows"
            :amounts="amounts"
            :item-count="itemCount"
            :total-inc-vat-label="t('common.to_pay_inc_vat')"
          />
        </div>

        <!-- Right: summary, rows sheet (mobile) and addresses -->
        <div class="space-y-6">
          <OrderSummaryCard
            :amounts="amounts"
            :item-count="itemCount"
            :total-inc-vat-label="t('common.to_pay_inc_vat')"
          />
          <PortalItemRowsSheet
            class="lg:hidden"
            :items="rows"
            :totals="totals"
            :trigger-label="t('portal.orders.detail.view_rows')"
            :title="t('portal.orders.detail.items.title')"
          />
          <OrderAddresses
            :billing-address="order.billingAddress"
            :shipping-address="order.shippingAddress"
            :customer-order-number="order.customerOrderNumber"
            :goods-label="order.goodsLabel"
            :desired-delivery-date="order.desiredDeliveryDate"
            :payment-method="orderPaymentLabel(order)"
          />
        </div>
      </div>
    </OrderConfirmation>
  </div>
</template>
