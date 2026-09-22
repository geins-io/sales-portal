<script setup lang="ts">
import { ShoppingCart } from 'lucide-vue-next';

const { localePath } = useLocaleMarket();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 py-24">
    <ShoppingCart class="text-muted-foreground size-16" />
    <p class="text-muted-foreground text-lg">
      {{ $t('cart.empty_cart') }}
    </p>
    <p class="text-muted-foreground text-sm">
      {{ $t('cart.empty_cart_message') }}
    </p>
    <NuxtLink
      :to="localePath('/')"
      class="bg-button-background text-primary-foreground hover:bg-button-background/90 mt-2 rounded-md px-6 py-2.5 text-sm font-medium transition-colors"
    >
      {{ $t('cart.continue_shopping') }}
    </NuxtLink>
  </div>
</template>
