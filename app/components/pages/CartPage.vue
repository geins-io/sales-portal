<script setup lang="ts">
import { ShoppingCart, X } from 'lucide-vue-next';
import { useCartStore } from '~/stores/cart';

const cartStore = useCartStore();
const router = useRouter();

// Fetch cart on mount if we have a cartId but no cart data
onMounted(() => {
  if (cartStore.cartId && !cartStore.cart) {
    cartStore.fetchCart();
  }
});

const shippingFee = computed(
  () => cartStore.cart?.summary?.shipping?.feeIncVatFormatted ?? null,
);

const taxFormatted = computed(
  () => cartStore.cart?.summary?.total?.vatFormatted ?? null,
);

function onClose() {
  router.back();
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-8" data-testid="cart-page">
    <!-- Header row -->
    <div class="mb-6 flex items-start justify-between">
      <h1 class="text-2xl font-bold" data-testid="cart-page-title">
        {{ $t('cart.shopping_cart') }}
        <span v-if="cartStore.itemCount > 0" class="font-bold">
          ({{ $t('cart.item_count', { count: cartStore.itemCount }) }})
        </span>
      </h1>
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground rounded-md border p-2 transition-colors"
        :aria-label="$t('common.close')"
        data-testid="cart-page-close"
        @click="onClose"
      >
        <X class="size-5" />
      </button>
    </div>

    <!-- Loading state -->
    <CartPageSkeleton
      v-if="cartStore.isLoading && !cartStore.cart"
      data-testid="cart-page-loading"
    />

    <!-- Empty state -->
    <div
      v-else-if="cartStore.isEmpty"
      class="flex flex-col items-center justify-center gap-4 py-24"
      data-testid="cart-page-empty"
    >
      <ShoppingCart class="text-muted-foreground size-16" />
      <p class="text-muted-foreground text-lg">
        {{ $t('cart.empty_cart') }}
      </p>
      <p class="text-muted-foreground text-sm">
        {{ $t('cart.empty_cart_message') }}
      </p>
      <NuxtLink
        to="/"
        class="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 rounded-md px-6 py-2.5 text-sm font-medium transition-colors"
      >
        {{ $t('cart.continue_shopping') }}
      </NuxtLink>
    </div>

    <!-- Cart content: items + summary -->
    <div v-else class="flex flex-col gap-8 lg:flex-row lg:items-start">
      <!-- LEFT: Cart items list -->
      <div class="min-w-0 flex-1">
        <ErrorBoundary section="cart-items">
          <div class="divide-border divide-y">
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

      <!-- RIGHT: Order Summary (sticky) -->
      <div class="w-full lg:w-80 lg:shrink-0">
        <ErrorBoundary section="order-summary">
          <div
            class="bg-muted border-border sticky top-24 space-y-4 rounded-lg border p-6"
            data-testid="cart-order-summary"
          >
            <h2 class="text-lg font-semibold">
              {{ $t('cart.order_summary') }}
            </h2>

            <div class="space-y-3">
              <!-- Subtotal -->
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">
                  {{
                    $t('cart.subtotal_items', { count: cartStore.itemCount })
                  }}
                </span>
                <span data-testid="cart-summary-subtotal">
                  {{
                    cartStore.cart?.summary?.subTotal
                      ?.sellingPriceIncVatFormatted ?? ''
                  }}
                </span>
              </div>

              <!-- Shipping -->
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">
                  {{ $t('cart.shipping') }}
                </span>
                <span data-testid="cart-summary-shipping">
                  {{ shippingFee ?? '--' }}
                </span>
              </div>

              <!-- Tax -->
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">
                  {{ $t('cart.tax_estimated') }}
                </span>
                <span data-testid="cart-summary-tax">
                  {{ taxFormatted ?? '--' }}
                </span>
              </div>
            </div>

            <!-- Divider -->
            <div class="border-border border-t" />

            <!-- Total -->
            <div class="flex items-center justify-between font-semibold">
              <span>{{ $t('cart.total') }}</span>
              <span data-testid="cart-summary-total">
                {{
                  cartStore.cart?.summary?.total?.sellingPriceIncVatFormatted ??
                  ''
                }}
              </span>
            </div>

            <!-- Checkout button -->
            <button
              type="button"
              class="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50"
              data-testid="cart-checkout-button"
              disabled
            >
              {{ $t('cart.proceed_to_checkout') }}
            </button>
          </div>
        </ErrorBoundary>
      </div>
    </div>

    <!-- Error -->
    <p
      v-if="cartStore.error"
      class="text-destructive mt-4 text-sm"
      data-testid="cart-page-error"
    >
      {{ cartStore.error }}
    </p>
  </div>
</template>
