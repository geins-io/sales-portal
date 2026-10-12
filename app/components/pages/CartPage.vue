<script setup lang="ts">
import { Tag, X } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useCartStore } from '~/stores/cart';
import { formatPrice } from '#shared/types/commerce';

const cartStore = useCartStore();
const router = useRouter();
const { formatLocale } = useFormatLocale();
const { localePath } = useLocaleMarket();
const { showPrice } = usePriceVisibility();
const { showIncVat } = useVatDisplay();

// Fetch cart on mount if we have a cartId but no cart data
onMounted(() => {
  if (cartStore.cartId && !cartStore.cart && !cartStore.needsSignIn) {
    cartStore.fetchCart();
  }
});

// Summary price computeds: pick incl-VAT or excl-VAT based on user preference.
// sellingPriceExVatFormatted is optional on PriceType, so fall back to IncVat when absent.
const subTotalFormatted = computed(() => {
  const s = cartStore.cart?.summary?.subTotal;
  return (
    (showIncVat.value
      ? s?.sellingPriceIncVatFormatted
      : (s?.sellingPriceExVatFormatted ?? s?.sellingPriceIncVatFormatted)) ?? ''
  );
});

const totalFormatted = computed(() => {
  const t = cartStore.cart?.summary?.total;
  return (
    (showIncVat.value
      ? t?.sellingPriceIncVatFormatted
      : (t?.sellingPriceExVatFormatted ?? t?.sellingPriceIncVatFormatted)) ?? ''
  );
});

// The row shows once the cart has a fee, in the buyer's VAT choice.
const shippingFee = computed(() => {
  const shipping = cartStore.cart?.summary?.shipping;
  if (!shipping?.feeIncVatFormatted) return null;
  if (showIncVat.value) return shipping.feeIncVatFormatted;
  return (
    shipping.feeExVatFormatted ||
    formatPrice(
      shipping.feeExVat,
      cartStore.cart?.summary?.total?.currency?.code,
      formatLocale.value,
    )
  );
});

const taxFormatted = computed(
  () => cartStore.cart?.summary?.total?.vatFormatted ?? null,
);

const discountFormatted = computed(() => {
  if (!cartStore.discountAmount) return '';
  const currency = cartStore.cart?.summary?.total?.currency;
  return formatPrice(
    showIncVat.value
      ? cartStore.discountAmount
      : (cartStore.cart?.summary?.fixedAmountDiscountExVat ?? 0),
    currency?.code,
    formatLocale.value,
  );
});

/**
 * Back to the page the buyer came from, when that page is ours: Vue Router
 * records it as `back` in the history state. Opened directly, there is no such
 * page, and going back would leave the portal.
 */
function onClose() {
  if (window.history.state?.back) router.back();
  else router.push(localePath('/'));
}

function goToCheckout() {
  router.push(localePath('/checkout'));
}
</script>

<template>
  <div class="py-8">
    <div class="mx-auto max-w-xl" data-testid="cart-page">
      <!-- Header row -->
      <div class="mb-6 px-6">
        <div class="flex items-start justify-between">
          <h1 class="text-2xl font-bold" data-testid="cart-page-title">
            {{ $t('cart.shopping_cart') }}
            <span v-if="cartStore.itemCount > 0" class="font-bold">
              ({{ $t('cart.item_count', { count: cartStore.itemCount }) }})
            </span>
          </h1>
          <Button
            variant="outline"
            size="icon"
            :aria-label="$t('common.close')"
            data-testid="cart-page-close"
            @click="onClose"
          >
            <X class="size-5" />
          </Button>
        </div>
        <p
          v-if="showPrice && !cartStore.isEmpty"
          class="text-muted-foreground text-sm"
          data-testid="cart-vat-note"
        >
          {{
            showIncVat ? $t('cart.prices_inc_vat') : $t('cart.prices_ex_vat')
          }}
        </p>
      </div>

      <!-- Loading state -->
      <CartPageSkeleton
        v-if="cartStore.isLoading && !cartStore.cart"
        class="px-6"
        data-testid="cart-page-loading"
      />

      <CartSignInPrompt
        v-else-if="cartStore.needsSignIn"
        class="py-24"
        data-testid="cart-page-sign-in"
      />

      <!-- Empty state -->
      <template v-else-if="cartStore.isEmpty">
        <CartSkippedNote class="mx-6" />
        <CartEmptyState data-testid="cart-page-empty" />
      </template>

      <!-- The lines, and under them the summary, pinned to the bottom of the
           window while the lines scroll past -->
      <template v-else>
        <div class="px-6">
          <CartSkippedNote class="mb-2" />
          <ErrorBoundary section="cart-items">
            <div
              class="divide-border border-border divide-y border-b"
              data-testid="cart-items"
            >
              <CartItem
                v-for="item in cartStore.cart?.items"
                :key="item.id"
                :item="item"
                @update-quantity="cartStore.updateQuantity"
                @remove="cartStore.removeItem"
              />
            </div>
          </ErrorBoundary>
        </div>

        <ErrorBoundary section="order-summary">
          <aside
            class="bg-muted border-border sticky bottom-0 z-10 flex flex-col gap-4 border-t px-6 py-5"
            data-testid="cart-order-summary"
          >
            <h2 class="text-base font-semibold">
              {{ $t('cart.order_summary') }}
            </h2>

            <dl class="space-y-2 text-sm">
              <template v-if="showPrice">
                <div class="flex items-center justify-between">
                  <dt class="text-muted-foreground">
                    {{ $t('cart.subtotal') }}
                  </dt>
                  <dd data-testid="cart-summary-subtotal">
                    {{ subTotalFormatted }}
                  </dd>
                </div>
                <div
                  v-if="cartStore.discountAmount"
                  class="flex items-center justify-between"
                  data-testid="cart-summary-discount"
                >
                  <dt class="text-destructive">
                    {{ $t('discount.discount') }}
                  </dt>
                  <dd
                    class="text-destructive font-medium"
                    data-testid="cart-summary-discount-amount"
                  >
                    -{{ discountFormatted }}
                  </dd>
                </div>
                <div class="flex items-center justify-between">
                  <dt class="text-muted-foreground">
                    {{ $t('cart.shipping') }}
                  </dt>
                  <dd data-testid="cart-summary-shipping">
                    <template v-if="shippingFee">{{ shippingFee }}</template>
                    <span v-else class="text-muted-foreground">{{
                      $t('common.shipping_may_apply')
                    }}</span>
                  </dd>
                </div>
                <div
                  v-if="taxFormatted"
                  class="flex items-center justify-between"
                >
                  <dt class="text-muted-foreground">
                    {{ $t(showIncVat ? 'common.vat_included' : 'common.vat') }}
                  </dt>
                  <dd data-testid="cart-summary-tax">{{ taxFormatted }}</dd>
                </div>
              </template>
              <div
                v-if="cartStore.visibleCartCampaigns.length"
                class="space-y-1"
                data-testid="cart-campaigns"
              >
                <div
                  v-for="campaign in cartStore.visibleCartCampaigns"
                  :key="campaign.name"
                  class="flex items-center gap-1 text-xs"
                >
                  <Tag class="text-destructive size-3" />
                  <span class="text-destructive">{{ campaign.name }}</span>
                </div>
              </div>
              <div v-if="showPrice" class="border-border border-t pt-3">
                <div
                  class="flex items-baseline justify-between text-lg font-semibold"
                >
                  <dt>{{ $t('cart.total') }}</dt>
                  <dd class="tabular-nums" data-testid="cart-summary-total">
                    {{ totalFormatted }}
                  </dd>
                </div>
              </div>
            </dl>

            <Button
              class="w-full"
              data-testid="cart-checkout-button"
              :disabled="cartStore.isLoading || cartStore.isUpdatingLines"
              @click="goToCheckout"
            >
              {{ $t('cart.proceed_to_checkout') }}
            </Button>
          </aside>
        </ErrorBoundary>
      </template>

      <!-- Error -->
      <p
        v-if="cartStore.error"
        class="text-destructive mt-4 px-6 text-sm"
        data-testid="cart-page-error"
      >
        {{ cartStore.error }}
      </p>
    </div>
  </div>
</template>
