<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useCartStore } from '~/stores/cart';

const cartStore = useCartStore();
</script>

<template>
  <div
    v-if="cartStore.loadFailed"
    role="alert"
    data-testid="cart-load-failed"
    class="bg-muted flex items-center gap-3 rounded-md px-4 py-3 text-sm"
  >
    <AlertCircle class="text-destructive size-4 shrink-0" />
    <span class="flex-1">{{
      $t(cartStore.isEmpty ? 'cart.load_failed' : 'cart.refresh_failed')
    }}</span>
    <Button
      variant="outline"
      size="sm"
      data-testid="cart-load-retry"
      :disabled="cartStore.isLoading"
      @click="cartStore.fetchCart()"
    >
      {{ $t('errors.retry') }}
    </Button>
  </div>
</template>
