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
import type { Company } from '#shared/types/company';
import { useCheckoutStore } from '~/stores/checkout';
import { useCartStore } from '~/stores/cart';
import { useAuthStore } from '~/stores/auth';
import { COOKIE_NAMES } from '#shared/constants/storage';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Checkbox } from '~/components/ui/checkbox';
import { Card, CardContent } from '~/components/ui/card';
import CheckoutCardHeader from '~/components/checkout/CheckoutCardHeader.vue';

definePageMeta({
  layout: 'checkout',
  middleware: 'feature',
  feature: 'checkout',
});

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const route = useRoute();
const cartStore = useCartStore();
const checkoutStore = useCheckoutStore();
const authStore = useAuthStore();

const isQuotationMode = computed(() => !!route.query.quotationId);

const isBillingAddressReadonly = computed(() => {
  return authStore.isAuthenticated && !!checkoutStore.checkout?.billingAddress;
});

const isShippingAddressReadonly = computed(() => {
  return authStore.isAuthenticated && !!checkoutStore.checkout?.shippingAddress;
});

// Company user detection: only fetch if authenticated to avoid 401s.
// Hydrate the auth store first if needed so SSR sees the correct auth state.
// Without this, the SSR pass runs before auth-init.client.ts has fired, the
// company fetch is skipped, and the page commits to the non-company UI on
// first paint even when the user is signed in.
if (!authStore.isInitialized) {
  await authStore.fetchUser();
}

const companyFetchData = ref<{ company: Company } | null>(null);
const companyFetchError = ref<unknown>(null);

if (authStore.isAuthenticated) {
  try {
    const { data, error } = await useFetch<{ company: Company }>(
      '/api/portal/company',
      { dedupe: 'defer' },
    );
    companyFetchData.value = data.value ?? null;
    companyFetchError.value = error.value ?? null;
  } catch (err) {
    companyFetchError.value = err;
  }
}

const isCompanyUser = computed(
  () => !!companyFetchData.value?.company && !companyFetchError.value,
);

const companyData = computed<Company | null>(
  () => companyFetchData.value?.company ?? null,
);

// Await tenant data before rendering — prevents flash of custom form when in hosted mode.
// Without this, checkoutMode defaults to 'custom' during client-side navigation while
// useFetch resolves, briefly showing the wrong UI.
const tenantData = useTenant();
await tenantData.suspense();
const { checkoutMode, isCatalogMode } = tenantData;

if (isCatalogMode.value) {
  await navigateTo(localePath('/'), { replace: true });
}

useHead({
  title: computed(() => t('checkout.title')),
});

// SSR-safe cart validation: useCookie works on both server and client.
// If no cart cookie exists, redirect immediately — no need to wait for onMounted.
const cartIdCookie = useCookie<string | null>(COOKIE_NAMES.CART_ID);
if (!cartIdCookie.value) {
  await navigateTo(localePath('/cart'), { replace: true });
}

// Load checkout data: payment options, shipping options, consents.
//
// Server: always fetch so SSR has data for the initial render.
// Client: refetch only if SSR didn't populate the store (e.g. SSR threw an
// auth race / transient API hiccup). The previous `callOnce` approach
// blocked the client retry entirely, so any SSR failure stuck the page on
// "Failed to load checkout" until full nav. Re-running fetchCheckout on
// client when the store is empty self-heals that path.
if (cartIdCookie.value) {
  if (import.meta.server) {
    await checkoutStore.fetchCheckout(cartIdCookie.value);
  } else if (
    !checkoutStore.checkout ||
    checkoutStore.error ||
    !checkoutStore.checkout.paymentOptions?.length
  ) {
    await checkoutStore.fetchCheckout(cartIdCookie.value);
  }
}

// Prefill from company after checkout loads so company data takes priority
if (isCompanyUser.value && companyData.value) {
  checkoutStore.prefillFromCompany(companyData.value);
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

// Terms agreement gate (page-local; keeps the store-level canPlaceOrder
// invariant decoupled from this specific UI requirement).
const acceptedTerms = ref(false);

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
    safeLocationRedirect(result.checkoutUrl);
  } catch {
    isRedirecting.value = false;
    redirectError.value = t('checkout.redirect_error');
  }
}

// Hosted checkout: redirect on the client during setup — before the template mounts.
// This eliminates the flash of the custom checkout form entirely.
if (import.meta.client && checkoutMode.value === 'hosted') {
  await handleHostedCheckout();
}

// Watch for successful order placement
watch(
  () => checkoutStore.orderResult,
  (result) => {
    if (result?.publicId) {
      navigateTo({
        path: localePath('/order-confirmation'),
        query: {
          orderId: result.publicId,
          orderNumber: result.orderId ?? undefined,
        },
      });
    }
  },
);

async function handlePlaceOrder() {
  if (!cartStore.cartId || !checkoutStore.canPlaceOrder) return;
  if (!acceptedTerms.value) return;
  await checkoutStore.placeOrder(cartStore.cartId);
}
</script>

<template>
  <div class="min-h-full bg-neutral-50">
    <div
      class="mx-auto max-w-7xl px-4 py-8 lg:px-6"
      data-testid="checkout-page"
    >
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

        <!-- Page heading -->
        <h1 class="mb-6 text-2xl font-semibold" data-testid="checkout-heading">
          {{ t('checkout.heading') }}
        </h1>

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
            <!-- Cart Items Summary -->
            <CheckoutCartItems
              :items="cartStore.cart?.items ?? []"
              :is-editable="!isQuotationMode"
            />

            <!-- Contact Information: company users see read-only company card -->
            <CheckoutCompanyInfo
              v-if="isCompanyUser && companyData"
              :company="companyData"
              :buyer-email="authStore.user?.username ?? undefined"
            />
            <Card v-else>
              <CheckoutCardHeader :icon="Mail" :title="t('checkout.email')" />
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

            <!-- Billing Address: hidden for company users (included in company card) -->
            <Card v-if="!isCompanyUser">
              <CheckoutCardHeader
                :icon="MapPin"
                :title="t('checkout.billing_address')"
              />
              <CardContent class="px-6">
                <CheckoutAddressForm
                  :model-value="checkoutStore.billingAddress"
                  prefix="billing"
                  :disabled="checkoutStore.isPlacingOrder"
                  :readonly="isBillingAddressReadonly"
                  @update:model-value="
                    Object.assign(checkoutStore.billingAddress, $event)
                  "
                />
              </CardContent>
            </Card>

            <!-- Shipping Address: company users see read-only delivery card -->
            <CheckoutDeliveryInfo
              v-if="isCompanyUser && companyData"
              :company="companyData"
            />
            <Card v-else-if="!isCompanyUser">
              <CheckoutCardHeader
                :icon="Truck"
                :title="t('checkout.shipping_address')"
              />
              <CardContent class="space-y-4 px-6">
                <div class="flex items-center gap-3">
                  <Checkbox
                    id="separate-shipping"
                    :checked="checkoutStore.useSeparateShipping"
                    data-testid="separate-shipping-toggle"
                    @update:checked="
                      checkoutStore.useSeparateShipping = !!$event
                    "
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
                  :readonly="isShippingAddressReadonly"
                  @update:model-value="
                    Object.assign(checkoutStore.shippingAddress, $event)
                  "
                />
              </CardContent>
            </Card>

            <!-- Payment Method -->
            <Card>
              <CheckoutCardHeader
                :icon="CreditCard"
                :title="t('checkout.payment_method')"
              />
              <CardContent class="px-6">
                <CheckoutPaymentOptions
                  :options="checkoutStore.paymentOptions"
                  :model-value="checkoutStore.selectedPaymentId"
                  :disabled="checkoutStore.isPlacingOrder"
                  @update:model-value="checkoutStore.selectedPaymentId = $event"
                />
              </CardContent>
            </Card>

            <!-- Order Message -->
            <Card>
              <CheckoutCardHeader
                :icon="MessageSquare"
                :title="t('checkout.order_message')"
              />
              <CardContent class="px-6">
                <textarea
                  id="checkout-message"
                  :value="checkoutStore.message"
                  :placeholder="t('checkout.order_message_placeholder')"
                  :disabled="checkoutStore.isPlacingOrder"
                  class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="checkout-message"
                  @input="
                    checkoutStore.message = (
                      $event.target as HTMLTextAreaElement
                    ).value
                  "
                />
              </CardContent>
            </Card>

            <!-- Consents: only rendered when there are non-auto-accepted consents -->
            <Card v-if="checkoutStore.consents?.some((c) => !c.autoAccept)">
              <CheckoutCardHeader
                :icon="FileCheck"
                :title="t('checkout.consents')"
              />
              <CardContent class="px-6">
                <CheckoutConsents
                  :consents="checkoutStore.consents"
                  :accepted="checkoutStore.acceptedConsents"
                  :disabled="checkoutStore.isPlacingOrder"
                  @toggle="checkoutStore.toggleConsent($event)"
                />
              </CardContent>
            </Card>

            <!-- Terms agreement: required before Place Order is enabled. -->
            <CheckoutTermsAgreement
              v-model="acceptedTerms"
              :disabled="checkoutStore.isPlacingOrder"
            />
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
              :can-place-order="
                checkoutStore.canPlaceOrder &&
                !checkoutStore.isBlacklisted &&
                acceptedTerms
              "
              :is-placing-order="checkoutStore.isPlacingOrder"
              @place-order="handlePlaceOrder"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
