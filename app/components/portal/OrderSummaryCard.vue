<script setup lang="ts">
import type { OrderAmounts } from '~/utils/order-view';

/** An order's summary amounts in the grey card. */
defineProps<{
  amounts: OrderAmounts;
  itemCount: number;
}>();

const { t } = useI18n();
const { showIncVat } = useVatDisplay();
</script>

<template>
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
        <span data-testid="order-summary-subtotal">{{ amounts.subtotal }}</span>
      </div>
      <div v-if="amounts.shipping" class="flex justify-between text-sm">
        <span class="text-muted-foreground">{{
          t('portal.orders.detail.summary.shipping')
        }}</span>
        <span data-testid="order-summary-shipping">{{ amounts.shipping }}</span>
      </div>
      <div v-if="amounts.paymentFee" class="flex justify-between text-sm">
        <span class="text-muted-foreground">{{ t('common.payment_fee') }}</span>
        <span data-testid="order-summary-payment-fee">{{
          amounts.paymentFee
        }}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-muted-foreground">{{
          t(showIncVat ? 'common.vat_included' : 'common.vat')
        }}</span>
        <span data-testid="order-summary-tax">{{ amounts.tax }}</span>
      </div>
      <div
        class="border-border mt-2 flex justify-between border-t pt-4 font-semibold"
      >
        <span>{{ t('portal.orders.detail.summary.total') }}</span>
        <span data-testid="order-summary-total">{{ amounts.total }}</span>
      </div>
      <div
        v-if="amounts.totalIncVat"
        class="text-muted-foreground flex justify-between text-sm"
      >
        <span>{{ t('common.total_inc_vat') }}</span>
        <span data-testid="order-summary-total-inc-vat">{{
          amounts.totalIncVat
        }}</span>
      </div>
    </div>
  </div>
</template>
