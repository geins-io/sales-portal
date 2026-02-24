<script setup lang="ts">
import { ShoppingCart } from 'lucide-vue-next';
import { useCartStore } from '~/stores/cart';

const cartStore = useCartStore();

const isOpen = computed({
  get: () => cartStore.isOpen,
  set: (val: boolean) => {
    cartStore.isOpen = val;
  },
});
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent side="right" class="flex w-full flex-col sm:max-w-md">
      <SheetHeader>
        <SheetTitle class="flex items-center gap-2">
          <ShoppingCart class="size-5" />
          {{ $t('cart.title') }}
          <span
            v-if="cartStore.itemCount > 0"
            class="text-muted-foreground text-sm font-normal"
          >
            ({{ $t('cart.item_count', { count: cartStore.itemCount }) }})
          </span>
        </SheetTitle>
        <SheetDescription class="sr-only">
          {{ $t('cart.your_cart_description') }}
        </SheetDescription>
      </SheetHeader>

      <!-- Loading state -->
      <div
        v-if="cartStore.isLoading && !cartStore.cart"
        class="flex flex-1 items-center justify-center"
      >
        <Icon
          name="lucide:loader-2"
          class="text-muted-foreground size-6 animate-spin"
        />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="cartStore.isEmpty"
        class="flex flex-1 flex-col items-center justify-center gap-3 px-4"
        data-testid="cart-empty"
      >
        <ShoppingCart class="text-muted-foreground size-12" />
        <p class="text-muted-foreground text-sm">{{ $t('cart.empty_cart') }}</p>
      </div>

      <!-- Cart items -->
      <template v-else>
        <div class="flex-1 overflow-y-auto px-4">
          <div class="divide-border divide-y">
            <CartItem
              v-for="item in cartStore.cart?.items"
              :key="item.id"
              :item="item"
              @update-quantity="cartStore.updateQuantity"
              @remove="cartStore.removeItem"
            />
          </div>
        </div>

        <!-- Promo code -->
        <div class="border-border border-t px-4 py-3">
          <CartPromoCodeInput
            :active-code="cartStore.cart?.promoCode ?? null"
            :loading="cartStore.isLoading"
            @apply="cartStore.applyPromoCode"
            @remove="cartStore.removePromoCode"
          />
        </div>

        <!-- Summary -->
        <div class="border-border space-y-2 border-t px-4 py-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">{{ $t('cart.subtotal') }}</span>
            <span>{{
              cartStore.cart?.summary?.subTotal?.sellingPriceIncVatFormatted ??
              ''
            }}</span>
          </div>
          <div class="flex items-center justify-between font-medium">
            <span>{{ $t('cart.total') }}</span>
            <span>{{
              cartStore.cart?.summary?.total?.sellingPriceIncVatFormatted ?? ''
            }}</span>
          </div>
        </div>

        <!-- Error -->
        <p v-if="cartStore.error" class="text-destructive px-4 text-sm">
          {{ cartStore.error }}
        </p>

        <!-- Checkout button -->
        <SheetFooter class="px-4 pb-4">
          <button
            type="button"
            class="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            disabled
          >
            {{ $t('cart.checkout') }}
          </button>
        </SheetFooter>
      </template>
    </SheetContent>
  </Sheet>
</template>
