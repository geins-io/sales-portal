<script setup lang="ts">
import { ShoppingCart } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useCartStore } from '~/stores/cart';
import { formatPrice } from '#shared/types/commerce';

const cartStore = useCartStore();
const router = useRouter();
const { tenant } = useTenant();
const { localePath } = useLocaleMarket();

const isOpen = computed({
  get: () => cartStore.isOpen,
  set: (val: boolean) => {
    cartStore.isOpen = val;
  },
});

const shippingFee = computed(
  () => cartStore.cart?.summary?.shipping?.feeIncVatFormatted ?? null,
);

const taxFormatted = computed(
  () => cartStore.cart?.summary?.total?.vatFormatted ?? null,
);

const discountFormatted = computed(() => {
  if (!cartStore.discountAmount) return '';
  const currency = cartStore.cart?.summary?.total?.currency;
  return formatPrice(
    cartStore.discountAmount,
    currency?.code,
    tenant.value?.locale,
  );
});

function goToCheckout() {
  cartStore.isOpen = false;
  router.push(localePath('/checkout'));
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 p-0 sm:max-w-md lg:max-w-4xl"
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

      <!-- Cart items + summary -->
      <template v-else>
        <div
          class="bg-muted/30 flex flex-1 flex-col overflow-hidden lg:flex-row"
        >
          <!-- Items column. Promo-code field is hidden per Figma; the
               feature stays in the store/API so re-enabling is a single
               re-render of `<PromoCodeInput>` once design wants it back. -->
          <div class="flex flex-1 flex-col overflow-hidden">
            <div class="flex-1 overflow-y-auto px-6 py-4">
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
          </div>

          <!-- Summary column. The summary itself is a single grey card —
               no border, exactly 340px wide on lg+, button sits inside
               the grey area below the totals. The column hosts breathing
               room around the card so it doesn't sit flush with the
               sheet edge per Figma. -->
          <aside
            class="border-border flex shrink-0 flex-col gap-4 overflow-y-auto border-t px-6 py-6 lg:w-auto lg:border-t-0 lg:border-l-0"
            data-testid="cart-summary"
          >
            <div
              class="bg-muted flex flex-col gap-5 rounded-lg p-6 lg:w-[340px]"
              data-testid="cart-summary-card"
            >
              <h2 class="text-base font-semibold">
                {{ $t('cart.order_summary') }}
              </h2>
              <dl class="space-y-3 text-sm">
                <div class="flex items-center justify-between">
                  <dt class="text-muted-foreground">
                    {{ $t('cart.subtotal') }}
                  </dt>
                  <dd>
                    {{
                      cartStore.cart?.summary?.subTotal
                        ?.sellingPriceIncVatFormatted ?? ''
                    }}
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
                  <dd class="text-destructive font-medium">
                    -{{ discountFormatted }}
                  </dd>
                </div>
                <div
                  v-if="shippingFee"
                  class="flex items-center justify-between"
                >
                  <dt class="text-muted-foreground">
                    {{ $t('cart.shipping') }}
                  </dt>
                  <dd>{{ shippingFee }}</dd>
                </div>
                <div
                  v-if="taxFormatted"
                  class="flex items-center justify-between"
                >
                  <dt class="text-muted-foreground">
                    {{ $t('cart.tax_estimated') }}
                  </dt>
                  <dd>{{ taxFormatted }}</dd>
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
                    <Icon name="lucide:tag" class="text-destructive size-3" />
                    <span class="text-destructive">{{ campaign.name }}</span>
                  </div>
                </div>
                <div class="border-border border-t pt-3">
                  <div class="flex items-center justify-between font-semibold">
                    <dt>{{ $t('cart.total') }}</dt>
                    <dd>
                      {{
                        cartStore.cart?.summary?.total
                          ?.sellingPriceIncVatFormatted ?? ''
                      }}
                    </dd>
                  </div>
                </div>
              </dl>

              <p v-if="cartStore.error" class="text-destructive text-sm">
                {{ cartStore.error }}
              </p>

              <Button
                class="w-full"
                data-testid="cart-drawer-checkout-button"
                :disabled="cartStore.isLoading"
                @click="goToCheckout"
              >
                {{ $t('cart.checkout') }}
              </Button>
            </div>
          </aside>
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
