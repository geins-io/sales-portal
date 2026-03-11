<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';
import { useCheckoutStore } from '~/stores/checkout';
import { useCartStore } from '~/stores/cart';
import { Separator } from '~/components/ui/separator';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Checkbox } from '~/components/ui/checkbox';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const cartStore = useCartStore();
const checkoutStore = useCheckoutStore();

useHead({
  title: computed(() => t('checkout.title')),
});

// Cart summary computeds (read from cart store — do NOT duplicate)
const subtotal = computed(
  () => cartStore.cart?.summary?.subTotal?.sellingPriceIncVatFormatted ?? '',
);
const shippingFee = computed(
  () => cartStore.cart?.summary?.shipping?.feeIncVatFormatted ?? null,
);
const tax = computed(
  () => cartStore.cart?.summary?.total?.vatFormatted ?? null,
);
const total = computed(
  () => cartStore.cart?.summary?.total?.sellingPriceIncVatFormatted ?? '',
);
const discountFormatted = computed(() => {
  if (!cartStore.discountAmount) return '';
  const { tenant } = useTenant();
  const currency = cartStore.cart?.summary?.total?.currency;
  return formatPrice(
    cartStore.discountAmount,
    currency?.code,
    tenant.value?.locale,
  );
});

// On mount: redirect if cart empty, otherwise fetch checkout
onMounted(async () => {
  if (cartStore.isEmpty) {
    await navigateTo('/cart');
    return;
  }
  if (cartStore.cartId) {
    await checkoutStore.fetchCheckout(cartStore.cartId);
  }
});

// Watch for successful order placement
watch(
  () => checkoutStore.orderResult,
  (result) => {
    if (result?.publicId) {
      navigateTo(`/order-confirmation/${result.publicId}`);
    }
  },
);

async function handlePlaceOrder() {
  if (!cartStore.cartId || !checkoutStore.canPlaceOrder) return;
  await checkoutStore.placeOrder(cartStore.cartId);
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-8" data-testid="checkout-page">
    <h1 class="mb-6 text-2xl font-bold" data-testid="checkout-title">
      {{ t('checkout.title') }}
    </h1>

    <!-- Error -->
    <div
      v-if="checkoutStore.error"
      class="bg-destructive/10 text-destructive mb-6 rounded-md p-4 text-sm"
      data-testid="checkout-error"
    >
      {{ checkoutStore.error }}
    </div>

    <!-- Blacklisted warning -->
    <div
      v-if="checkoutStore.isBlacklisted"
      class="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800"
      data-testid="checkout-blacklisted"
    >
      {{ t('checkout.blacklisted') }}
    </div>

    <!-- Loading state -->
    <div
      v-if="checkoutStore.isLoading"
      class="flex items-center justify-center py-24"
      data-testid="checkout-loading"
    >
      <Loader2 class="text-muted-foreground size-8 animate-spin" />
    </div>

    <!-- Main content -->
    <div v-else class="flex flex-col gap-8 lg:flex-row lg:items-start">
      <!-- LEFT: Checkout form -->
      <div class="min-w-0 flex-1 space-y-8">
        <!-- Email -->
        <div class="space-y-2">
          <Label for="checkout-email">{{ t('checkout.email') }}</Label>
          <Input
            id="checkout-email"
            :model-value="checkoutStore.email"
            type="email"
            autocomplete="email"
            data-testid="checkout-email"
            @update:model-value="checkoutStore.email = $event as string"
          />
        </div>

        <!-- Identity Number -->
        <div class="space-y-2">
          <Label for="checkout-identity">{{
            t('checkout.identity_number')
          }}</Label>
          <Input
            id="checkout-identity"
            :model-value="checkoutStore.identityNumber"
            type="text"
            data-testid="checkout-identity"
            @update:model-value="
              checkoutStore.identityNumber = $event as string
            "
          />
        </div>

        <Separator />

        <!-- Billing Address -->
        <div>
          <h2 class="mb-4 text-lg font-semibold">
            {{ t('checkout.billing_address') }}
          </h2>
          <CheckoutCheckoutAddressForm
            :model-value="checkoutStore.billingAddress"
            prefix="billing"
            :disabled="checkoutStore.isPlacingOrder"
            @update:model-value="
              Object.assign(checkoutStore.billingAddress, $event)
            "
          />
        </div>

        <Separator />

        <!-- Shipping Address Toggle -->
        <div class="flex items-center gap-3">
          <Checkbox
            id="separate-shipping"
            :checked="checkoutStore.useSeparateShipping"
            data-testid="separate-shipping-toggle"
            @update:checked="checkoutStore.useSeparateShipping = !!$event"
          />
          <Label for="separate-shipping" class="cursor-pointer text-sm">
            {{ t('checkout.use_different_shipping') }}
          </Label>
        </div>

        <!-- Shipping Address (conditional) -->
        <div v-if="checkoutStore.useSeparateShipping">
          <h2 class="mb-4 text-lg font-semibold">
            {{ t('checkout.shipping_address') }}
          </h2>
          <CheckoutCheckoutAddressForm
            :model-value="checkoutStore.shippingAddress"
            prefix="shipping"
            :disabled="checkoutStore.isPlacingOrder"
            @update:model-value="
              Object.assign(checkoutStore.shippingAddress, $event)
            "
          />
        </div>

        <Separator />

        <!-- Payment Options -->
        <div>
          <h2 class="mb-4 text-lg font-semibold">
            {{ t('checkout.payment_method') }}
          </h2>
          <CheckoutCheckoutPaymentOptions
            :options="checkoutStore.paymentOptions"
            :model-value="checkoutStore.selectedPaymentId"
            :disabled="checkoutStore.isPlacingOrder"
            @update:model-value="checkoutStore.selectedPaymentId = $event"
          />
        </div>

        <Separator />

        <!-- Shipping Options -->
        <div>
          <h2 class="mb-4 text-lg font-semibold">
            {{ t('checkout.shipping_method') }}
          </h2>
          <CheckoutCheckoutShippingOptions
            :options="checkoutStore.shippingOptions"
            :model-value="checkoutStore.selectedShippingId"
            :disabled="checkoutStore.isPlacingOrder"
            @update:model-value="checkoutStore.selectedShippingId = $event"
          />
        </div>

        <Separator />

        <!-- Order Message -->
        <div class="space-y-2">
          <Label for="checkout-message">{{
            t('checkout.order_message')
          }}</Label>
          <textarea
            id="checkout-message"
            :value="checkoutStore.message"
            :placeholder="t('checkout.order_message_placeholder')"
            :disabled="checkoutStore.isPlacingOrder"
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="checkout-message"
            @input="
              checkoutStore.message = (
                $event.target as HTMLTextAreaElement
              ).value
            "
          />
        </div>

        <Separator />

        <!-- Consents -->
        <div>
          <h2 class="mb-4 text-lg font-semibold">
            {{ t('checkout.consents') }}
          </h2>
          <CheckoutCheckoutConsents
            :consents="checkoutStore.consents"
            :accepted="checkoutStore.acceptedConsents"
            :disabled="checkoutStore.isPlacingOrder"
            @toggle="checkoutStore.toggleConsent($event)"
          />
        </div>

        <Separator />

        <!-- Place Order Button -->
        <Button
          type="button"
          class="w-full py-3"
          :disabled="
            !checkoutStore.canPlaceOrder ||
            checkoutStore.isPlacingOrder ||
            checkoutStore.isBlacklisted
          "
          data-testid="place-order-button"
          @click="handlePlaceOrder"
        >
          <Loader2
            v-if="checkoutStore.isPlacingOrder"
            class="mr-2 size-4 animate-spin"
          />
          {{
            checkoutStore.isPlacingOrder
              ? t('checkout.placing_order')
              : t('checkout.place_order')
          }}
        </Button>
      </div>

      <!-- RIGHT: Order Summary Sidebar -->
      <div class="w-full lg:w-80 lg:shrink-0">
        <CheckoutCheckoutOrderSummary
          :item-count="cartStore.itemCount"
          :subtotal="subtotal"
          :shipping-fee="shippingFee"
          :tax="tax"
          :total="total"
          :discount="discountFormatted || undefined"
        />
      </div>
    </div>
  </div>
</template>
