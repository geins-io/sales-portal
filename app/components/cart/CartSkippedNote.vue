<script setup lang="ts">
import { Info } from 'lucide-vue-next';
import { useCartStore } from '~/stores/cart';

const cartStore = useCartStore();
const { t } = useI18n();
</script>

<template>
  <p
    v-if="cartStore.skippedConfigurable > 0"
    role="status"
    data-testid="cart-skipped-configurable"
    class="bg-muted flex items-start gap-2 rounded-md px-4 py-3 text-sm"
  >
    <Info class="text-muted-foreground mt-0.5 size-4 shrink-0" />
    <span>{{
      t('cart.skipped_configurable', {
        count: cartStore.skippedConfigurable,
      })
    }}</span>
  </p>
</template>
