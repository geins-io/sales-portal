<script setup lang="ts">
import type { OrderDetailType } from '#shared/types/commerce';
import type { PortalItemRow, SummaryRow } from '#shared/types/portal-rows';
import { productPath } from '#shared/utils/route-helpers';
import { replayLineHref } from '~/utils/configurator-replay';
import { orderAmounts, orderPaymentLabel, orderRows } from '~/utils/order-view';
import { summaryRows } from '~/utils/summary-rows';

/** A just-placed order, as the portal order page shows it, with the same parts. */
const props = defineProps<{
  order: OrderDetailType;
  /** The key a configured row's replay link names the order by. */
  publicOrderId: string;
  /** The payment terms, which an order from a quotation takes from it. */
  paymentTerms?: string;
}>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const { formatLocale } = useFormatLocale();
const { showIncVat } = useVatDisplay();
const { showPrice } = usePriceVisibility();

const itemCount = computed(() => props.order.cart?.items?.length ?? 0);
const amounts = computed(() =>
  orderAmounts(props.order, showIncVat.value, formatLocale.value),
);

/** A configured row's product page, with that row's choices replayed. */
function replayHref(
  canonical: string | null | undefined,
  row: number,
): string | undefined {
  if (!canonical) return undefined;
  return replayLineHref(localePath(productPath(canonical)), {
    publicOrderId: props.publicOrderId,
    row,
  });
}

const rows = computed<PortalItemRow[]>(() =>
  orderRows(props.order, showIncVat.value, replayHref),
);
const totals = computed<SummaryRow[]>(() =>
  summaryRows(
    amounts.value,
    itemCount.value,
    showIncVat.value,
    (key, named) => t(key, named ?? {}),
    { totalIncVatLabel: t('common.to_pay_inc_vat') },
  ),
);
</script>

<template>
  <div
    data-testid="confirmation-order"
    class="border-border mt-8 grid grid-cols-1 gap-6 rounded-lg border bg-white p-6 lg:grid-cols-3"
  >
    <!-- Left: rows (desktop only; mobile uses the sheet) -->
    <div class="hidden lg:col-span-2 lg:block">
      <OrderItemsTable :items="rows" :rows="totals" :show-prices="showPrice" />
    </div>

    <!-- Right: summary, rows sheet (mobile) and addresses -->
    <div class="space-y-6">
      <OrderSummaryCard :rows="totals" :show-prices="showPrice" />
      <PortalItemRowsSheet
        class="lg:hidden"
        :items="rows"
        :totals="totals"
        :trigger-label="t('portal.orders.detail.view_rows')"
        :title="t('portal.orders.detail.items.title')"
        :show-prices="showPrice"
      />
      <OrderAddresses
        :billing-address="order.billingAddress"
        :shipping-address="order.shippingAddress"
        :customer-order-number="order.customerOrderNumber"
        :goods-label="order.goodsLabel"
        :desired-delivery-date="order.desiredDeliveryDate"
        :payment-method="orderPaymentLabel(order)"
        :payment-terms="paymentTerms"
      />
    </div>
  </div>
</template>
