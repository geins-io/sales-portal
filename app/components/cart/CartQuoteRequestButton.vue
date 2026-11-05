<script setup lang="ts">
import { FileText, Loader2 } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useCartStore } from '~/stores/cart';
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();
const cartStore = useCartStore();
const auth = useAuthStore();
const router = useRouter();
const { canAccess } = useFeatureAccess();
const { formatLocale } = useFormatLocale();
const { localePath } = useLocaleMarket();

// The route needs a session even where a tenant opens quotes to all.
const show = computed(
  () =>
    auth.isAuthenticated && canAccess('quotes') && canAccess('quoteRequests'),
);
const working = ref(false);

async function addCartToQuote() {
  working.value = true;
  const date = new Intl.DateTimeFormat(formatLocale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
  const id = await cartStore.requestQuote(
    t('cart.quote_request_name', { date }),
  );
  working.value = false;
  if (id) {
    await router.push(
      localePath(`/portal/quotations/${encodeURIComponent(id)}/request`),
    );
  }
}
</script>

<template>
  <template v-if="show">
    <Button
      variant="outline"
      class="-mt-1 w-full gap-2 shadow-none"
      data-testid="cart-add-to-quote"
      :disabled="working || cartStore.isLoading || cartStore.isUpdatingLines"
      @click="addCartToQuote"
    >
      <Loader2 v-if="working" class="size-4 animate-spin" />
      <FileText v-else class="size-4" />
      {{ t('cart.add_to_quote') }}
    </Button>
    <p
      class="text-muted-foreground -mt-2 text-xs"
      data-testid="cart-add-to-quote-hint"
    >
      {{ t('cart.add_to_quote_hint') }}
    </p>
    <p
      v-if="cartStore.quoteRequestError"
      role="alert"
      class="text-danger -mt-2 text-sm"
      data-testid="cart-add-to-quote-error"
    >
      {{ t(cartStore.quoteRequestError) }}
    </p>
  </template>
</template>
