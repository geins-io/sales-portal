<script setup lang="ts">
import type { Component } from 'vue';
import { Loader2 } from 'lucide-vue-next';
import { Separator } from '~/components/ui/separator';
import { Button } from '~/components/ui/button';

const { t } = useI18n();
const { showPrice } = usePriceVisibility();
const { showIncVat } = useVatDisplay();

const props = withDefaults(
  defineProps<{
    itemCount: number;
    subtotal: string;
    shippingFee: string | null;
    tax: string | null;
    total: string;
    discount?: string;
    /** The charge incl. VAT, shown under the total on the ex side only. */
    toPayIncVat?: string;
    /** The label of that line; "to pay" by default. */
    toPayLabel?: string;
    canPlaceOrder: boolean;
    isPlacingOrder: boolean;
    termsAccepted: boolean;
    /** False leaves the terms box out and stops it gating the button. */
    requireTerms?: boolean;
    title?: string;
    actionLabel?: string;
    actionPendingLabel?: string;
    /** Shown instead of a fee that is not known yet. */
    shippingNote?: string;
    /** The pluralized key the subtotal's count reads with. */
    itemCountKey?: string;
    /** Beside the button text while not placing. */
    actionIcon?: Component;
  }>(),
  { requireTerms: true, itemCountKey: 'checkout.items_count' },
);

defineSlots<{
  /** Beside the heading, at its end. */
  'title-aside'?: () => unknown;
  /** Under the button, inside the summary. */
  footer?: () => unknown;
}>();

const emit = defineEmits<{
  placeOrder: [];
  'update:termsAccepted': [value: boolean];
}>();
</script>

<template>
  <div
    class="bg-muted border-border sticky top-24 space-y-4 rounded-lg border p-6"
    data-testid="checkout-order-summary"
  >
    <div
      class="flex items-start justify-between gap-2"
      data-testid="checkout-summary-heading"
    >
      <h2 class="text-lg font-semibold">
        {{ props.title ?? t('checkout.order_summary') }}
      </h2>
      <slot name="title-aside" />
    </div>

    <div v-if="showPrice" class="space-y-3">
      <!-- Subtotal -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">
          {{ t('checkout.subtotal') }}
          ({{ t(props.itemCountKey, { count: props.itemCount }) }})
        </span>
        <span data-testid="checkout-summary-subtotal">
          {{ props.subtotal || '--' }}
        </span>
      </div>

      <!-- Discount -->
      <div
        v-if="props.discount"
        class="flex items-center justify-between text-sm"
        data-testid="checkout-summary-discount"
      >
        <span class="text-danger">{{ t('checkout.discount') }}</span>
        <span
          class="text-danger font-medium"
          data-testid="checkout-summary-discount-amount"
          >-{{ props.discount }}</span
        >
      </div>

      <!-- Shipping -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">
          {{ t('checkout.shipping') }}
        </span>
        <span data-testid="checkout-summary-shipping">
          <template v-if="props.shippingFee">{{ props.shippingFee }}</template>
          <span v-else class="text-muted-foreground">{{
            props.shippingNote ?? t('common.shipping_may_apply')
          }}</span>
        </span>
      </div>

      <!-- Tax -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">
          {{ t(showIncVat ? 'common.vat_included' : 'common.vat') }}
        </span>
        <span data-testid="checkout-summary-tax">
          {{ props.tax }}
        </span>
      </div>
    </div>

    <Separator v-if="showPrice" />

    <!-- Total -->
    <div
      v-if="showPrice"
      class="flex items-center justify-between font-semibold"
    >
      <span>{{ t('checkout.total') }}</span>
      <span data-testid="checkout-summary-total">
        {{ props.total || '--' }}
      </span>
    </div>
    <div
      v-if="showPrice && !showIncVat && props.toPayIncVat"
      class="text-muted-foreground flex items-center justify-between text-sm"
      data-testid="checkout-summary-to-pay"
    >
      <span>{{ props.toPayLabel ?? t('common.to_pay_inc_vat') }}</span>
      <span>{{ props.toPayIncVat }}</span>
    </div>

    <!-- Terms agreement gates the button, so it sits directly above the CTA.
         Otherwise the requirement is buried at the bottom of the form column
         while the disabled button floats in this sticky sidebar. -->
    <CheckoutTermsAgreement
      v-if="props.requireTerms"
      :model-value="props.termsAccepted"
      :disabled="props.isPlacingOrder"
      @update:model-value="emit('update:termsAccepted', $event)"
    />

    <!-- Place Order -->
    <Button
      type="button"
      size="lg"
      class="w-full"
      :disabled="
        !props.canPlaceOrder ||
        (props.requireTerms && !props.termsAccepted) ||
        props.isPlacingOrder
      "
      data-testid="place-order-button"
      @click="emit('placeOrder')"
    >
      <Loader2 v-if="props.isPlacingOrder" class="mr-2 size-4 animate-spin" />
      <component
        :is="props.actionIcon"
        v-else-if="props.actionIcon"
        class="mr-2 size-4"
        data-testid="place-order-icon"
      />
      {{
        props.isPlacingOrder
          ? (props.actionPendingLabel ?? t('checkout.placing_order'))
          : (props.actionLabel ?? t('checkout.place_order'))
      }}
    </Button>
    <slot name="footer" />
  </div>
</template>
