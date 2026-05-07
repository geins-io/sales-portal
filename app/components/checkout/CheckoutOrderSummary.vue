<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';
import { Separator } from '~/components/ui/separator';
import { Button } from '~/components/ui/button';

const { t } = useI18n();

const props = defineProps<{
  itemCount: number;
  subtotal: string;
  shippingFee: string | null;
  tax: string | null;
  total: string;
  discount?: string;
  canPlaceOrder: boolean;
  isPlacingOrder: boolean;
}>();

const emit = defineEmits<{
  placeOrder: [];
}>();
</script>

<template>
  <div
    class="bg-muted border-border sticky top-24 space-y-4 rounded-lg border p-6"
    data-testid="checkout-order-summary"
  >
    <h2 class="text-lg font-semibold">
      {{ t('checkout.order_summary') }}
    </h2>

    <div class="space-y-3">
      <!-- Subtotal -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">
          {{ t('checkout.subtotal') }}
          ({{ t('checkout.items_count', { count: props.itemCount }) }})
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
        <span class="text-destructive">{{ t('checkout.discount') }}</span>
        <span class="text-destructive font-medium">-{{ props.discount }}</span>
      </div>

      <!-- Shipping -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">
          {{ t('checkout.shipping') }}
        </span>
        <span data-testid="checkout-summary-shipping">
          {{ props.shippingFee ?? '--' }}
        </span>
      </div>

      <!-- Tax -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">
          {{ t('checkout.tax') }}
        </span>
        <span data-testid="checkout-summary-tax">
          {{ props.tax ?? '--' }}
        </span>
      </div>
    </div>

    <Separator />

    <!-- Total -->
    <div class="flex items-center justify-between font-semibold">
      <span>{{ t('checkout.total') }}</span>
      <span data-testid="checkout-summary-total">
        {{ props.total || '--' }}
      </span>
    </div>

    <!-- Place Order -->
    <Button
      type="button"
      size="lg"
      class="w-full"
      :disabled="!props.canPlaceOrder || props.isPlacingOrder"
      data-testid="place-order-button"
      @click="emit('placeOrder')"
    >
      <Loader2 v-if="props.isPlacingOrder" class="mr-2 size-4 animate-spin" />
      {{
        props.isPlacingOrder
          ? t('checkout.placing_order')
          : t('checkout.place_order')
      }}
    </Button>
  </div>
</template>
