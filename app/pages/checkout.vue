<script setup lang="ts">
import {
  Loader2,
  Mail,
  MapPin,
  CreditCard,
  Truck,
  MessageSquare,
  FileCheck,
} from 'lucide-vue-next';
import { useCheckoutStore } from '~/stores/checkout';
import { useCartStore } from '~/stores/cart';
import { COOKIE_NAMES } from '#shared/constants/storage';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Checkbox } from '~/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';

definePageMeta({ layout: 'checkout' });

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const cartStore = useCartStore();
const checkoutStore = useCheckoutStore();
const { checkoutMode } = useTenant();

useHead({
  title: computed(() => t('checkout.title')),
});

// SSR-safe cart validation: useCookie works on both server and client.
// If no cart cookie exists, redirect immediately — no need to wait for onMounted.
const cartIdCookie = useCookie<string | null>(COOKIE_NAMES.CART_ID);
if (!cartIdCookie.value) {
  await navigateTo(localePath('/cart'), { replace: true });
}

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

// Hosted checkout state
const isRedirecting = ref(false);
const redirectError = ref<string | null>(null);

async function handleHostedCheckout() {
  if (!cartStore.cartId) return;
  isRedirecting.value = true;
  redirectError.value = null;
  try {
    const result = await $fetch<{ token: string; checkoutUrl: string }>(
      '/api/checkout/token',
      {
        method: 'POST',
        body: { cartId: cartStore.cartId },
      },
    );
    window.location.href = result.checkoutUrl;
  } catch {
    isRedirecting.value = false;
    redirectError.value = t('checkout.redirect_error');
  }
}

// Fetch checkout data when component mounts (client-side hydration)
onMounted(async () => {
  if (!cartIdCookie.value) {
    await navigateTo(localePath('/cart'), { replace: true });
    return;
  }

  // Always use hosted checkout — Geins handles auth and payment on their side.
  // Custom checkout form is not yet implemented; when it is, gate on checkoutMode here.
  await handleHostedCheckout();
});

// Watch for successful order placement
watch(
  () => checkoutStore.orderResult,
  (result) => {
    if (result?.publicId) {
      navigateTo(localePath(`/order-confirmation/${result.publicId}`));
    }
  },
);

// Watch for successful quote request
watch(
  () => checkoutStore.quoteResult,
  (result) => {
    if (result?.quoteId) {
      navigateTo(
        localePath(
          `/quote-confirmation/${result.quoteId}?quoteNumber=${encodeURIComponent(result.quoteNumber)}`,
        ),
      );
    }
  },
);

async function handlePlaceOrder() {
  if (!cartStore.cartId || !checkoutStore.canPlaceOrder) return;
  await checkoutStore.placeOrder(cartStore.cartId);
}

async function handleRequestQuote() {
  if (!cartStore.cartId || !checkoutStore.canRequestQuote) return;
  await checkoutStore.requestQuote(cartStore.cartId);
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-8" data-testid="checkout-page">
    <!-- Hosted checkout: redirect state -->
    <div
      v-if="checkoutMode === 'hosted'"
      class="flex flex-col items-center justify-center gap-4 py-24"
      data-testid="checkout-hosted"
    >
      <div
        v-if="!redirectError"
        class="flex flex-col items-center gap-3"
        data-testid="checkout-redirecting"
      >
        <Loader2 class="text-muted-foreground size-8 animate-spin" />
        <p class="text-muted-foreground text-sm">
          {{ t('checkout.redirecting') }}
        </p>
      </div>
      <div
        v-else
        class="flex flex-col items-center gap-4"
        data-testid="checkout-redirect-error"
      >
        <p class="text-destructive text-sm">{{ redirectError }}</p>
        <Button
          type="button"
          variant="outline"
          data-testid="checkout-retry-button"
          @click="handleHostedCheckout"
        >
          {{ t('checkout.retry') }}
        </Button>
      </div>
    </div>

    <!-- Custom checkout -->
    <template v-else>
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
        <div class="min-w-0 flex-1 space-y-6">
          <!-- Contact Information -->
          <Card>
            <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
              <Mail class="text-muted-foreground size-5" />
              <CardTitle class="text-lg">{{ t('checkout.email') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4 px-6">
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
            </CardContent>
          </Card>

          <!-- Billing Address -->
          <Card>
            <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
              <MapPin class="text-muted-foreground size-5" />
              <CardTitle class="text-lg">{{
                t('checkout.billing_address')
              }}</CardTitle>
            </CardHeader>
            <CardContent class="px-6">
              <CheckoutAddressForm
                :model-value="checkoutStore.billingAddress"
                prefix="billing"
                :disabled="checkoutStore.isPlacingOrder"
                @update:model-value="
                  Object.assign(checkoutStore.billingAddress, $event)
                "
              />
            </CardContent>
          </Card>

          <!-- Shipping Address -->
          <Card>
            <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
              <Truck class="text-muted-foreground size-5" />
              <CardTitle class="text-lg">{{
                t('checkout.shipping_address')
              }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4 px-6">
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
              <CheckoutAddressForm
                v-if="checkoutStore.useSeparateShipping"
                :model-value="checkoutStore.shippingAddress"
                prefix="shipping"
                :disabled="checkoutStore.isPlacingOrder"
                @update:model-value="
                  Object.assign(checkoutStore.shippingAddress, $event)
                "
              />
            </CardContent>
          </Card>

          <!-- Payment Method -->
          <Card>
            <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
              <CreditCard class="text-muted-foreground size-5" />
              <CardTitle class="text-lg">{{
                t('checkout.payment_method')
              }}</CardTitle>
            </CardHeader>
            <CardContent class="px-6">
              <CheckoutPaymentOptions
                :options="checkoutStore.paymentOptions"
                :model-value="checkoutStore.selectedPaymentId"
                :disabled="checkoutStore.isPlacingOrder"
                @update:model-value="checkoutStore.selectedPaymentId = $event"
              />
            </CardContent>
          </Card>

          <!-- Shipping Method -->
          <Card>
            <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
              <Truck class="text-muted-foreground size-5" />
              <CardTitle class="text-lg">{{
                t('checkout.shipping_method')
              }}</CardTitle>
            </CardHeader>
            <CardContent class="px-6">
              <CheckoutShippingOptions
                :options="checkoutStore.shippingOptions"
                :model-value="checkoutStore.selectedShippingId"
                :disabled="checkoutStore.isPlacingOrder"
                @update:model-value="checkoutStore.selectedShippingId = $event"
              />
            </CardContent>
          </Card>

          <!-- Order Message -->
          <Card>
            <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
              <MessageSquare class="text-muted-foreground size-5" />
              <CardTitle class="text-lg">{{
                t('checkout.order_message')
              }}</CardTitle>
            </CardHeader>
            <CardContent class="px-6">
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
            </CardContent>
          </Card>

          <!-- Consents -->
          <Card>
            <CardHeader class="flex-row items-center gap-2 space-y-0 px-6 pb-0">
              <FileCheck class="text-muted-foreground size-5" />
              <CardTitle class="text-lg">{{
                t('checkout.consents')
              }}</CardTitle>
            </CardHeader>
            <CardContent class="px-6">
              <CheckoutConsents
                :consents="checkoutStore.consents"
                :accepted="checkoutStore.acceptedConsents"
                :disabled="checkoutStore.isPlacingOrder"
                @toggle="checkoutStore.toggleConsent($event)"
              />
            </CardContent>
          </Card>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-3 sm:flex-row">
            <!-- Place Order Button -->
            <Button
              type="button"
              class="flex-1 py-3"
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

            <!-- Request Quote Button -->
            <Button
              type="button"
              variant="outline"
              class="flex-1 py-3"
              :disabled="
                !checkoutStore.canRequestQuote ||
                checkoutStore.isRequestingQuote ||
                checkoutStore.isBlacklisted
              "
              data-testid="request-quote-button"
              @click="handleRequestQuote"
            >
              <Loader2
                v-if="checkoutStore.isRequestingQuote"
                class="mr-2 size-4 animate-spin"
              />
              {{
                checkoutStore.isRequestingQuote
                  ? t('quote.requesting_quote')
                  : t('quote.request_quote')
              }}
            </Button>
          </div>
        </div>

        <!-- RIGHT: Order Summary Sidebar -->
        <div class="w-full lg:w-80 lg:shrink-0">
          <CheckoutOrderSummary
            :item-count="cartStore.itemCount"
            :subtotal="subtotal"
            :shipping-fee="shippingFee"
            :tax="tax"
            :total="total"
            :discount="discountFormatted || undefined"
          />
        </div>
      </div>
    </template>
  </div>
</template>
