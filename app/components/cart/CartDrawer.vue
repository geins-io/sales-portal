<script setup lang="ts">
import { Loader2, ShoppingCart, Tag } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useCartStore } from '~/stores/cart';
import { formatPrice } from '#shared/types/commerce';

const cartStore = useCartStore();
const router = useRouter();
const { isCatalogMode } = useTenant();
const { formatLocale } = useFormatLocale();
const { canAccess } = useFeatureAccess();
const { localePath } = useLocaleMarket();
const { showIncVat } = useVatDisplay();
const { showPrice } = usePriceVisibility();

// Belt and suspenders: even when no entry point opens the drawer, a stale
// store flag must not surface the purchase funnel on tenants where order
// placement is disabled.
const showDrawer = computed(
  () => !isCatalogMode.value && canAccess('orderPlacement'),
);

const isOpen = computed({
  get: () => showDrawer.value && cartStore.isOpen,
  set: (val: boolean) => {
    cartStore.isOpen = val;
  },
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

// The fee in the buyer's VAT choice, or null before the cart has one.
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

function goToCheckout() {
  cartStore.isOpen = false;
  router.push(localePath('/checkout'));
}
</script>

<template>
  <Sheet v-if="showDrawer" v-model:open="isOpen">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      data-testid="cart-drawer"
    >
      <SheetHeader class="border-border border-b px-6 py-5">
        <SheetTitle class="flex items-center gap-2 text-2xl font-semibold">
          {{ $t('cart.title') }}
          <span
            v-if="cartStore.itemCount > 0"
            class="text-muted-foreground text-base font-normal"
          >
            ({{ $t('cart.item_count', { count: cartStore.itemCount }) }})
          </span>
        </SheetTitle>
        <SheetDescription class="sr-only">
          {{ $t('cart.your_cart_description') }}
        </SheetDescription>
        <p
          v-if="showPrice && !cartStore.isEmpty"
          class="text-muted-foreground text-sm"
          data-testid="cart-vat-note"
        >
          {{
            showIncVat ? $t('cart.prices_inc_vat') : $t('cart.prices_ex_vat')
          }}
        </p>
      </SheetHeader>

      <!-- Loading state -->
      <div
        v-if="cartStore.isLoading && !cartStore.cart"
        class="flex flex-1 items-center justify-center"
      >
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
      </div>

      <CartSignInPrompt
        v-else-if="cartStore.needsSignIn"
        class="flex-1"
        data-testid="cart-sign-in"
      />

      <!-- Empty state; a bulk add that added nothing still says why -->
      <template v-else-if="cartStore.isEmpty">
        <CartSkippedNote class="mx-6 mt-4" />
        <div
          class="flex flex-1 flex-col items-center justify-center gap-3 px-4"
          data-testid="cart-empty"
        >
          <ShoppingCart class="text-muted-foreground size-12" />
          <p class="text-muted-foreground text-sm">
            {{ $t('cart.empty_cart') }}
          </p>
        </div>
      </template>

      <!-- The lines scroll; the summary stays at the bottom, whatever their number -->
      <template v-else>
        <!-- Promo-code field is hidden per Figma; the feature stays in the
             store/API so re-enabling is a single re-render of
             `<PromoCodeInput>` once design wants it back. -->
        <div
          class="bg-muted/30 min-h-0 flex-1 overflow-y-auto px-6 py-4"
          data-testid="cart-drawer-list"
        >
          <CartSkippedNote class="mb-2" />
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
        </div>

        <aside
          class="bg-muted border-border flex shrink-0 flex-col gap-4 border-t px-6 py-5"
          data-testid="cart-summary"
        >
          <h2 class="text-base font-semibold">
            {{ $t('cart.order_summary') }}
          </h2>
          <dl class="space-y-2 text-sm">
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
            <div v-if="taxFormatted" class="flex items-center justify-between">
              <dt class="text-muted-foreground">
                {{ $t(showIncVat ? 'common.vat_included' : 'common.vat') }}
              </dt>
              <dd data-testid="cart-summary-tax">{{ taxFormatted }}</dd>
            </div>
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
            <div class="border-border border-t pt-3">
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

          <p
            v-if="cartStore.error"
            class="text-destructive text-sm"
            data-testid="cart-error"
          >
            {{ cartStore.error }}
          </p>

          <Button
            class="w-full"
            data-testid="cart-drawer-checkout-button"
            :disabled="cartStore.isLoading || cartStore.isUpdatingLines"
            @click="goToCheckout"
          >
            {{ $t('cart.checkout') }}
          </Button>
        </aside>
      </template>
    </SheetContent>
  </Sheet>
</template>
